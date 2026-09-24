import test from 'node:test';
import assert from 'node:assert';
import { TaskQueue } from '../src/task-queue.js';

test('TaskQueue', { concurrency: 1 }, async (t) => {

  await t.test('should execute tasks in sequential FIFO order', async () => {
    const queue = new TaskQueue();
    const executionOrder: number[] = [];

    const task1 = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      executionOrder.push(1);
      return 'task1-result';
    });

    const task2 = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push(2);
      return 'task2-result';
    });

    const task3 = queue.enqueue(async () => {
      executionOrder.push(3);
      return 'task3-result';
    });

    const results = await Promise.all([task1, task2, task3]);

    assert.deepStrictEqual(executionOrder, [1, 2, 3]);
    assert.deepStrictEqual(results, ['task1-result', 'task2-result', 'task3-result']);
  });

  await t.test('should ensure only one task runs at a time (no concurrency)', async () => {
    const queue = new TaskQueue();
    let runningTasks = 0;
    let maxConcurrentTasks = 0;

    const createTask = () =>
      queue.enqueue(async () => {
        runningTasks++;
        maxConcurrentTasks = Math.max(maxConcurrentTasks, runningTasks);
        await new Promise((resolve) => setTimeout(resolve, 20));
        runningTasks--;
      });

    await Promise.all([createTask(), createTask(), createTask()]);

    assert.strictEqual(maxConcurrentTasks, 1, 'Only one task should be running at any time');
    assert.strictEqual(runningTasks, 0, 'All tasks should be finished');
  });

  await t.test('should continue processing remaining tasks even if a task fails', async () => {
    const queue = new TaskQueue();
    const executed: string[] = [];

    const task1 = queue.enqueue(async () => {
      executed.push('task1');
      return 'ok1';
    });

    const task2 = queue.enqueue(async () => {
      executed.push('task2');
      throw new Error('Task 2 failed');
    });

    const task3 = queue.enqueue(async () => {
      executed.push('task3');
      return 'ok3';
    });

    const result1 = await task1;
    assert.strictEqual(result1, 'ok1');

    await assert.rejects(task2, {
      name: 'Error',
      message: 'Task 2 failed'
    });

    const result3 = await task3;
    assert.strictEqual(result3, 'ok3');

    assert.deepStrictEqual(executed, ['task1', 'task2', 'task3']);
  });

  await t.test('should reject when queue reaches maxSize', async () => {
    const queue = new TaskQueue(2);

    const blocker = queue.enqueue(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    );

    const pending1 = queue.enqueue(async () => 'pending1');
    const pending2 = queue.enqueue(async () => 'pending2');

    await assert.rejects(
      queue.enqueue(async () => 'overflow'),
      {
        name: 'Error',
        message: 'Max queue size reached'
      }
    );

    await Promise.all([blocker, pending1, pending2]);
  });

  await t.test('should safely handle synchronous exceptions inside task without freezing queue', async () => {
    const queue = new TaskQueue();

    const syncFaultyTask = queue.enqueue((() => {
      throw new Error('Synchronous crash');
    }) as any);

    const nextNormalTask = queue.enqueue(async () => 'recovered-successfully');

    await assert.rejects(syncFaultyTask, {
      name: 'Error',
      message: 'Synchronous crash'
    });

    const result = await nextNormalTask;
    assert.strictEqual(result, 'recovered-successfully', 'Queue must recover and execute subsequent task');
  });

  await t.test('should handle multiple burst cycles with idle periods between them', async () => {
    const queue = new TaskQueue();

    const burst1 = await Promise.all([
      queue.enqueue(async () => 1),
      queue.enqueue(async () => 2)
    ]);
    assert.deepStrictEqual(burst1, [1, 2]);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const burst2 = await Promise.all([
      queue.enqueue(async () => 3),
      queue.enqueue(async () => 4)
    ]);
    assert.deepStrictEqual(burst2, [3, 4]);
  });

  await t.test('should completely drain and reset internal state after processing a batch of tasks', async () => {
    const queue = new TaskQueue(200);
    const taskCount = 100;
    const promises: Promise<number>[] = [];

    for (let i = 0; i < taskCount; i++) {
      promises.push(queue.enqueue(async () => i));
    }

    const results = await Promise.all(promises);

    assert.strictEqual(results.length, 100, 'All 100 tasks must resolve');
    assert.strictEqual((queue as any).queue.length, 0, 'Internal queue array must be empty');
    assert.strictEqual((queue as any).isProcessing, false, 'isProcessing flag must be false after completion');
  });
});
