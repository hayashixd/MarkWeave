import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./app";

describe("App", () => {
  it("renders the app shell with tab bar", async () => {
    render(<App />);
    // 初回起動時に Untitled タブが表示される
    // useSessionRestore は useEffect 内で非同期に実行されるため waitFor を使う
    await waitFor(() => {
      expect(screen.getByText("Untitled-1")).toBeInTheDocument();
    });
  });

  it("renders the status bar", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Markdown")).toBeInTheDocument();
    });
  });
});
