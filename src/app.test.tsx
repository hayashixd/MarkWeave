import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./app";

describe("App", () => {
  it("renders the app shell with tab bar", () => {
    render(<App />);
    // 初回起動時に Untitled タブが表示される
    expect(screen.getByText("Untitled-1")).toBeInTheDocument();
  });

  it("renders the status bar", () => {
    render(<App />);
    expect(screen.getByText("Markdown")).toBeInTheDocument();
  });
});
