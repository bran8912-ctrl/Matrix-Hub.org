import("./verify_all_polygon.js").catch((error) => {
  console.error(`Polygon verification failed to start: ${error.message}`);
  process.exitCode = 1;
});