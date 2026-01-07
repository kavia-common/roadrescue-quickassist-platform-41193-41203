import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders admin brand", async () => {
  render(<App />);
  // App bootstraps auth state asynchronously, so the navbar renders after a short delay.
  expect(await screen.findByText(/RoadRescue/i)).toBeInTheDocument();
});
