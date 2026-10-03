import { renderAtmosphereGrid } from './atmosphere.js';

self.addEventListener('message', (event) => {
  const { requestId, sunAltDeg, sunAzDeg, width = 128, height = 64, quality } = event.data;
  try {
    const started = performance.now();
    const grid = renderAtmosphereGrid({ width, height, sunAltDeg, sunAzDeg, quality });
    const step = () => {
      try {
        if (!grid.run()) {
          setTimeout(step, 0);
          return;
        }
        self.postMessage({
          requestId,
          width,
          height,
          data: grid.data.buffer,
          elapsedMs: performance.now() - started,
        }, [grid.data.buffer]);
      } catch (error) {
        self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) });
      }
    };
    step();
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) });
  }
});
