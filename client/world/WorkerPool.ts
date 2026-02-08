export interface WorkerMeshResult {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  waterPositions: Float32Array;
  waterNormals: Float32Array;
  waterColors: Float32Array;
  waterIndices: Uint32Array;
}

interface PendingJob {
  id: number;
  chunkData: Uint8Array;
  neighbors: {
    px?: Uint8Array;
    nx?: Uint8Array;
    py?: Uint8Array;
    ny?: Uint8Array;
    pz?: Uint8Array;
    nz?: Uint8Array;
  };
  cx: number;
  cy: number;
  cz: number;
  priority: number;
  resolve: (result: WorkerMeshResult | null) => void;
  reject: (error: Error) => void;
}

interface WorkerEntry {
  worker: Worker;
  busy: boolean;
}

export class WorkerPool {
  private workers: WorkerEntry[] = [];
  private queue: PendingJob[] = [];
  private nextId = 0;
  private pendingResolves = new Map<number, { resolve: (result: WorkerMeshResult | null) => void; reject: (error: Error) => void }>();

  constructor() {
    const count = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 1));

    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL('./ChunkMeshWorker.ts', import.meta.url),
        { type: 'module' }
      );

      const entry: WorkerEntry = { worker, busy: false };

      worker.onmessage = (e: MessageEvent) => {
        const { id, result } = e.data;
        const pending = this.pendingResolves.get(id);
        if (pending) {
          this.pendingResolves.delete(id);
          pending.resolve(result);
        }
        entry.busy = false;
        this.dispatch();
      };

      worker.onerror = (e) => {
        console.error('Worker error:', e);
        entry.busy = false;
        this.dispatch();
      };

      this.workers.push(entry);
    }
  }

  meshChunk(
    chunkData: Uint8Array,
    neighbors: {
      px?: Uint8Array;
      nx?: Uint8Array;
      py?: Uint8Array;
      ny?: Uint8Array;
      pz?: Uint8Array;
      nz?: Uint8Array;
    },
    cx: number,
    cy: number,
    cz: number,
    priority: number = 0,
  ): Promise<WorkerMeshResult | null> {
    return new Promise((resolve, reject) => {
      const job: PendingJob = {
        id: this.nextId++,
        chunkData,
        neighbors,
        cx,
        cy,
        cz,
        priority,
        resolve,
        reject,
      };

      // Insert into queue sorted by priority (higher priority first)
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (job.priority > this.queue[i].priority) {
          this.queue.splice(i, 0, job);
          inserted = true;
          break;
        }
      }
      if (!inserted) this.queue.push(job);

      this.dispatch();
    });
  }

  private dispatch(): void {
    for (const entry of this.workers) {
      if (entry.busy || this.queue.length === 0) continue;

      const job = this.queue.shift()!;
      entry.busy = true;

      this.pendingResolves.set(job.id, { resolve: job.resolve, reject: job.reject });

      // Build transferable neighbor buffers
      const neighborBuffers: Record<string, ArrayBuffer | undefined> = {};
      for (const key of ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const) {
        const arr = job.neighbors[key];
        if (arr) {
          // Copy into a fresh ArrayBuffer since chunk data is shared
          neighborBuffers[key] = new Uint8Array(arr).buffer;
        }
      }

      // Copy chunk data buffer since it belongs to the chunk entry
      const chunkBuffer = new Uint8Array(job.chunkData).buffer;

      const transferable: ArrayBuffer[] = [chunkBuffer];
      for (const buf of Object.values(neighborBuffers)) {
        if (buf) transferable.push(buf);
      }

      entry.worker.postMessage(
        {
          id: job.id,
          chunkData: chunkBuffer,
          neighbors: neighborBuffers,
          cx: job.cx,
          cy: job.cy,
          cz: job.cz,
        },
        transferable,
      );
    }
  }

  dispose(): void {
    for (const entry of this.workers) {
      entry.worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.pendingResolves.clear();
  }
}
