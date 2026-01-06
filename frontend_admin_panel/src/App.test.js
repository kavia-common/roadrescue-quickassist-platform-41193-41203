import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders admin brand", () => {
  render(<App />);
  expect(screen.getByText(/RoadRescue/i)).toBeInTheDocument();
});
