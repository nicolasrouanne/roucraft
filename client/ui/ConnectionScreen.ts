export interface ConnectionResult {
  mode: 'create' | 'join' | 'solo';
  playerName: string;
  roomCode?: string;
}

export class ConnectionScreen {
  private container: HTMLDivElement;
  private onConnect: ((result: ConnectionResult) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = parent.querySelector('#connection-screen') as HTMLDivElement;
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'connection-screen';
      parent.appendChild(this.container);
    }
    this.render();
  }

  setOnConnect(callback: (result: ConnectionResult) => void): void {
    this.onConnect = callback;
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  showError(message: string): void {
    const errorEl = this.container.querySelector('#cs-error') as HTMLDivElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  showRoomCode(code: string): void {
    const codeEl = this.container.querySelector('#cs-room-code-display') as HTMLDivElement;
    if (codeEl) {
      codeEl.textContent = `Room Code: ${code}`;
      codeEl.style.display = 'block';
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div style="
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 40px;
        width: 380px;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      ">
        <h1 style="
          color: #fff;
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 2px;
        ">RouCraft</h1>
        <p style="
          color: #888;
          margin: 0 0 28px 0;
          font-size: 14px;
        ">Voxel World</p>

        <div style="margin-bottom: 20px;">
          <input
            id="cs-name"
            type="text"
            placeholder="Your name"
            maxlength="16"
            style="
              width: 100%;
              padding: 10px 14px;
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 6px;
              color: #fff;
              font-size: 15px;
              outline: none;
              box-sizing: border-box;
              font-family: 'Segoe UI', sans-serif;
            "
          />
        </div>

        <div id="cs-error" style="
          display: none;
          color: #ff6b6b;
          font-size: 13px;
          margin-bottom: 12px;
          padding: 8px;
          background: rgba(255, 50, 50, 0.1);
          border-radius: 4px;
        "></div>

        <div id="cs-room-code-display" style="
          display: none;
          color: #6bff6b;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(50, 255, 50, 0.1);
          border-radius: 6px;
          letter-spacing: 4px;
        "></div>

        <button id="cs-create" style="
          width: 100%;
          padding: 12px;
          margin-bottom: 10px;
          background: #4a7cff;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Segoe UI', sans-serif;
          transition: background 0.2s;
        ">Create Room</button>

        <div style="
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        ">
          <input
            id="cs-room-code"
            type="text"
            placeholder="Room code"
            maxlength="6"
            style="
              flex: 1;
              padding: 10px 14px;
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 6px;
              color: #fff;
              font-size: 15px;
              outline: none;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-family: 'Segoe UI', sans-serif;
            "
          />
          <button id="cs-join" style="
            padding: 10px 20px;
            background: #4aaa4a;
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            font-family: 'Segoe UI', sans-serif;
            transition: background 0.2s;
          ">Join</button>
        </div>

        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 16px 0;
        ">
          <hr style="flex: 1; border: none; border-top: 1px solid rgba(255,255,255,0.1);" />
          <span style="color: #666; font-size: 12px;">OR</span>
          <hr style="flex: 1; border: none; border-top: 1px solid rgba(255,255,255,0.1);" />
        </div>

        <button id="cs-solo" style="
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #ccc;
          font-size: 15px;
          cursor: pointer;
          font-family: 'Segoe UI', sans-serif;
          transition: background 0.2s;
        ">Play Solo</button>
      </div>
    `;

    // Add hover effects
    const buttons = this.container.querySelectorAll('button');
    buttons.forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        btn.style.filter = 'brightness(1.15)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.filter = 'brightness(1)';
      });
    });

    // Wire up events
    const nameInput = this.container.querySelector('#cs-name') as HTMLInputElement;
    const codeInput = this.container.querySelector('#cs-room-code') as HTMLInputElement;
    const createBtn = this.container.querySelector('#cs-create') as HTMLButtonElement;
    const joinBtn = this.container.querySelector('#cs-join') as HTMLButtonElement;
    const soloBtn = this.container.querySelector('#cs-solo') as HTMLButtonElement;

    // Auto-uppercase room code input
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase();
    });

    createBtn.addEventListener('click', () => {
      const name = this.validateName(nameInput.value);
      if (!name) return;
      this.onConnect?.({ mode: 'create', playerName: name });
    });

    joinBtn.addEventListener('click', () => {
      const name = this.validateName(nameInput.value);
      if (!name) return;
      const code = codeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) {
        this.showError('Please enter a valid room code');
        return;
      }
      this.onConnect?.({ mode: 'join', playerName: name, roomCode: code });
    });

    soloBtn.addEventListener('click', () => {
      const name = this.validateName(nameInput.value);
      if (!name) return;
      this.onConnect?.({ mode: 'solo', playerName: name });
    });

    // Enter key on room code field triggers join
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinBtn.click();
      }
    });

    // Enter key on name field triggers create
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        createBtn.click();
      }
    });
  }

  private validateName(raw: string): string | null {
    const name = raw.trim();
    if (!name) {
      this.showError('Please enter your name');
      return null;
    }
    if (name.length < 2) {
      this.showError('Name must be at least 2 characters');
      return null;
    }
    // Clear previous errors
    const errorEl = this.container.querySelector('#cs-error') as HTMLDivElement;
    if (errorEl) errorEl.style.display = 'none';
    return name;
  }
}
