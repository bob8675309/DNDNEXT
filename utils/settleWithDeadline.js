export async function settleWithDeadline(task, {
  timeoutMs,
  onTimeout,
} = {}) {
  const limit = Math.max(0, Number(timeoutMs) || 0);
  let timeoutId = null;

  const settledTask = Promise.resolve(task).then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason })
  );

  const deadline = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      try {
        onTimeout?.();
      } finally {
        resolve({ status: "timeout" });
      }
    }, limit);
  });

  const outcome = await Promise.race([settledTask, deadline]);
  if (timeoutId) clearTimeout(timeoutId);
  return outcome;
}
