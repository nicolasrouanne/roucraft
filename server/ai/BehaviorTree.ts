export enum NodeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING',
}

export interface Blackboard {
  [key: string]: any;
}

export interface BehaviorNode {
  tick(blackboard: Blackboard, dt: number): NodeStatus;
  reset?(): void;
}

/** Runs children in order; fails on the first failure, succeeds when all succeed. */
export class Sequence implements BehaviorNode {
  private currentIndex = 0;

  constructor(private children: BehaviorNode[]) {}

  tick(blackboard: Blackboard, dt: number): NodeStatus {
    while (this.currentIndex < this.children.length) {
      const status = this.children[this.currentIndex].tick(blackboard, dt);
      if (status === NodeStatus.RUNNING) return NodeStatus.RUNNING;
      if (status === NodeStatus.FAILURE) {
        this.currentIndex = 0;
        return NodeStatus.FAILURE;
      }
      this.currentIndex++;
    }
    this.currentIndex = 0;
    return NodeStatus.SUCCESS;
  }

  reset(): void {
    this.currentIndex = 0;
    for (const child of this.children) child.reset?.();
  }
}

/** Runs children in order; succeeds on the first success, fails when all fail. */
export class Selector implements BehaviorNode {
  private currentIndex = 0;

  constructor(private children: BehaviorNode[]) {}

  tick(blackboard: Blackboard, dt: number): NodeStatus {
    while (this.currentIndex < this.children.length) {
      const status = this.children[this.currentIndex].tick(blackboard, dt);
      if (status === NodeStatus.RUNNING) return NodeStatus.RUNNING;
      if (status === NodeStatus.SUCCESS) {
        this.currentIndex = 0;
        return NodeStatus.SUCCESS;
      }
      this.currentIndex++;
    }
    this.currentIndex = 0;
    return NodeStatus.FAILURE;
  }

  reset(): void {
    this.currentIndex = 0;
    for (const child of this.children) child.reset?.();
  }
}

/** Wraps a function as a leaf node. */
export class Leaf implements BehaviorNode {
  constructor(private fn: (blackboard: Blackboard, dt: number) => NodeStatus) {}

  tick(blackboard: Blackboard, dt: number): NodeStatus {
    return this.fn(blackboard, dt);
  }
}

/** Inverts SUCCESS/FAILURE of the child; RUNNING passes through. */
export class Inverter implements BehaviorNode {
  constructor(private child: BehaviorNode) {}

  tick(blackboard: Blackboard, dt: number): NodeStatus {
    const status = this.child.tick(blackboard, dt);
    if (status === NodeStatus.SUCCESS) return NodeStatus.FAILURE;
    if (status === NodeStatus.FAILURE) return NodeStatus.SUCCESS;
    return NodeStatus.RUNNING;
  }

  reset(): void {
    this.child.reset?.();
  }
}

/** Repeats the child a fixed number of times (or forever if count = 0). */
export class Repeater implements BehaviorNode {
  private iteration = 0;

  constructor(private child: BehaviorNode, private count: number = 0) {}

  tick(blackboard: Blackboard, dt: number): NodeStatus {
    const status = this.child.tick(blackboard, dt);
    if (status === NodeStatus.RUNNING) return NodeStatus.RUNNING;

    this.iteration++;
    if (this.count > 0 && this.iteration >= this.count) {
      this.iteration = 0;
      return NodeStatus.SUCCESS;
    }

    this.child.reset?.();
    return NodeStatus.RUNNING;
  }

  reset(): void {
    this.iteration = 0;
    this.child.reset?.();
  }
}
