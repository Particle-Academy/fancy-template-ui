/**
 * The golden quote: every built-in block, a letterhead, a repeat with a page
 * each and a host block, compiled and rendered with sample data. The rendered
 * documents are committed (tests/fixtures/rendered-goldens.json) so a PHP check
 * can put them through fine-print's own validator and writer:
 *
 *   php scripts/validate-fine-print.php ../fine-print
 *
 * This test fails when the committed file is stale; run with UPDATE_GOLDENS=1
 * to rewrite it, then re-run the PHP check.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inspect, render } from "@particle-academy/fancy-template";
import { goldenContext, goldenData, goldenState } from "./golden";
import { compile } from "../src/core";

const FILE = join(__dirname, "fixtures/rendered-goldens.json");

describe("golden quote", () => {
  it("compiles clean and renders; the committed rendering is current", () => {
    const out = compile(goldenState(), goldenContext);
    expect(out.problems).toEqual([]);
    expect(inspect(out.template).issues).toEqual([]);
    const rendered = {
      oneItem: render(out.template, goldenData(1)),
      threeItems: render(out.template, goldenData(3)),
    };
    const text = JSON.stringify(rendered, null, 2) + "\n";
    if (process.env.UPDATE_GOLDENS) writeFileSync(FILE, text);
    expect(readFileSync(FILE, "utf8").replace(/\r\n/g, "\n")).toBe(text);
  });
});
