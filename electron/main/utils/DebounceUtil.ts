export const throttle = <T, A extends unknown[]>(
  callback: (...args: A) => void,
  wait: number,
  context: T
): (() => void) => {
  let timeout: NodeJS.Timeout | null = null;
  let previous: Date | null = null;

  return function (...args: A) {
    const now = new Date();
    if (!previous) {
      previous = now;
    }

    const remaining = wait - (now.getTime() - previous.getTime()!);
    if (remaining <= 0) {
      clearTimeout(timeout!);
      timeout = null;
      previous = now;
      callback.apply(context, args);
    }
  };
};
