import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstanceBanner } from "./InstanceBanner";

describe("InstanceBanner", () => {
  it("names a non-production instance", () => {
    render(<InstanceBanner label="Development" />);
    expect(screen.getByRole("note")).toHaveTextContent("Development instance");
  });

  it("renders nothing in production", () => {
    const { container } = render(<InstanceBanner label="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
