import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders admin brand", async () => {
  render(<App />);
  // The word "RoadRescue" also appears in the footer, so target the navbar brand link specifically.
  expect(await screen.findByRole("link", { name: /RoadRescue Admin/i })).toBeInTheDocument();
});
