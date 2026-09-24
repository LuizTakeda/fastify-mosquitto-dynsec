/**
 * Represents an item waiting to be processed in the queue.
 */
type QueueItem = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  task: () => Promise<any>;
};

/**
 * A FIFO task queue that executes asynchronous tasks sequentially.
 */
export class TaskQueue {
  private maxSize: number;
  private queue: QueueItem[] = [];
  private isProcessing = false;

  /**
   * @param maxSize - Maximum number of pending tasks allowed in the queue.
   */
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Processes the next task in the queue if none is currently running.
   */
  private processTask(): void {
    if (this.isProcessing) {
      return;
    }

    const item = this.queue.shift();

    if (!item) {
      return;
    }

    this.isProcessing = true;

    const { resolve, reject, task } = item;

    Promise.resolve()
      .then(() => task())
      .then(
        (val) => {
          this.isProcessing = false;
          this.processTask();
          resolve(val);
        },
        (err) => {
          this.isProcessing = false;
          this.processTask();
          reject(err);
        }
      );
  }

  /**
   * Enqueues an async task to run sequentially after previous tasks complete.
   *
   * @param task - Async function to be executed.
   * @returns Promise resolving to the result of the task.
   */
  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxSize) {
      return Promise.reject(new Error('Max queue size reached'));
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject, task });
      this.processTask();
    });
  }
}