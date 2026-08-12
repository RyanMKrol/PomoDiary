// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulletJotter } from "./BulletJotter";
import { useState } from "react";

/** Mimics the real client: applies updateDraft patches back into props so
 *  controlled inputs actually accept typed text. */
function StatefulJotter({
  initial,
  spy,
  mode = "running",
}: {
  initial: string[];
  spy: (patch: { bullets?: string[] }) => void;
  mode?: string;
}) {
  const [bullets, setBullets] = useState(initial);
  return (
    <BulletJotter
      timerState={{ mode: mode as never, draftBullets: bullets }}
      updateDraft={(patch) => {
        spy(patch);
        if (patch.bullets) setBullets(patch.bullets);
      }}
    />
  );
}
import { type UseTimerResult } from "@/lib/client/useTimer";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("BulletJotter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders with running mode copy", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      expect(screen.getByText("As you go")).toBeInTheDocument();
      expect(screen.getByText("Enter for the next bullet")).toBeInTheDocument();
    });

    it("renders with recap mode copy", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      expect(screen.getByText("What did you actually do?")).toBeInTheDocument();
      expect(screen.getByText("Tidy it up")).toBeInTheDocument();
    });

    it("renders bullet marker with correct color", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["test"],
        draftTag: "Learning",
      };

      const { container } = render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const marker = container.querySelector('[data-testid="bullet-marker-0"]');
      expect(marker).toHaveStyle("background-color: #ec3013");
    });

    it("renders with default accent color when no tag", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: [""],
        draftTag: null,
      };

      const { container } = render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const marker = container.querySelector('[data-testid="bullet-marker-0"]');
      expect(marker).toHaveStyle("background-color: #ec3013");
    });

    it("renders correct placeholder for first bullet in running mode", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-0") as HTMLInputElement;
      expect(input.placeholder).toBe("Jot it down while it's fresh…");
    });

    it("renders correct placeholder for first bullet in recap mode", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-0") as HTMLInputElement;
      expect(input.placeholder).toBe("Anything else worth noting?");
    });

    it("renders ellipsis placeholders above the composer, the invitation on it", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "second", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const middle = screen.getByTestId("bullet-input-1") as HTMLInputElement;
      expect(middle.placeholder).toBe("…");
      const composer = screen.getByTestId("bullet-input-2") as HTMLInputElement;
      expect(composer.placeholder).toBe("Jot it down while it's fresh…");
    });

    it("always renders an empty composer row after a seeded draft", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["At the gym (2 min)", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const composer = screen.getByTestId("bullet-input-1") as HTMLInputElement;
      expect(composer.value).toBe("");
      expect(composer.placeholder).toBe("Jot it down while it's fresh…");
    });

    it("renders multiple bullets", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "second", "third"],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      expect(screen.getByTestId("bullet-input-0")).toHaveValue("first");
      expect(screen.getByTestId("bullet-input-1")).toHaveValue("second");
      expect(screen.getByTestId("bullet-input-2")).toHaveValue("third");
    });
  });

  describe("typing", () => {
    it("updates draft on text input", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-0") as HTMLInputElement;
      await userEvent.type(input, "h");

      expect(updateDraft).toHaveBeenCalled();
      const calls = updateDraft.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0].bullets?.[0]).toBe("h");
    });

    it("updates correct bullet when multiple exist", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-1") as HTMLInputElement;
      await userEvent.type(input, "s");

      const calls = updateDraft.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0].bullets?.[1]).toBe("s");
    });
  });

  describe("Enter key behavior", () => {
    it("Enter in the composer commits the text and appends a fresh slot", async () => {
      const spy = vi.fn();
      render(
        <StatefulJotter initial={["first", "typed this", ""]} spy={spy} />,
      );

      // The composer is the appended empty last slot (index 2), rendered
      // FIRST. Typing fills it; Enter commits by appending a fresh slot.
      const composer = screen.getByTestId("bullet-input-2");
      await userEvent.click(composer);
      await userEvent.keyboard("more{Enter}");

      const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
      expect(lastCall[0].bullets).toEqual(["first", "typed this", "more", ""]);
    });

    it("keeps the cursor in the composer across a commit", async () => {
      const spy = vi.fn();
      render(<StatefulJotter initial={["first", ""]} spy={spy} />);

      const composer = screen.getByTestId("bullet-input-1");
      await userEvent.click(composer);
      await userEvent.keyboard("note{Enter}");

      // Same element, still focused, now representing the fresh slot.
      expect(document.activeElement).toBe(composer);
      expect((composer as HTMLInputElement).value).toBe("");
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
      expect(lastCall[0].bullets).toEqual(["first", "note", ""]);
    });

    it("Enter on a committed row spawns nothing and returns focus to the composer", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "second", "third", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const row = screen.getByTestId("bullet-input-1");
      await userEvent.click(row);
      await userEvent.keyboard("{Enter}");

      expect(updateDraft).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByTestId("bullet-input-3"));
    });

    it("does not propagate form submission on Enter", async () => {
      const spy = vi.fn();
      render(<StatefulJotter initial={["something jotted", ""]} spy={spy} />);

      const composer = screen.getByTestId("bullet-input-1");
      await userEvent.click(composer);
      await userEvent.keyboard("x{Enter}");

      const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
      expect(lastCall[0].bullets).toEqual(["something jotted", "x", ""]);
    });
  });

  describe("Backspace key behavior", () => {
    it("does nothing on Backspace when only one bullet exists", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-0");
      await userEvent.click(input);
      await userEvent.keyboard("{Backspace}");

      const backspaceCalls = updateDraft.mock.calls.filter(
        (call) => call[0].bullets && (call[0].bullets as string[]).length === 0,
      );
      expect(backspaceCalls.length).toBe(0);
    });

    it("removes an emptied committed row on Backspace", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "", "third", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const row = screen.getByTestId("bullet-input-1");
      await userEvent.click(row);
      await userEvent.keyboard("{Backspace}");

      const lastCall =
        updateDraft.mock.calls[updateDraft.mock.calls.length - 1];
      expect(lastCall[0].bullets).toEqual(["first", "third", ""]);
    });

    it("removes middle empty bullet", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "", "third", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-1");
      await userEvent.click(input);
      await userEvent.keyboard("{Backspace}");

      const lastCall =
        updateDraft.mock.calls[updateDraft.mock.calls.length - 1];
      expect(lastCall[0].bullets).toEqual(["first", "third", ""]);
    });

    it("does not remove non-empty bullet on Backspace", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "second"],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-1") as HTMLInputElement;
      await userEvent.click(input);
      expect(screen.getByTestId("bullet-input-0")).toHaveValue("first");
      expect(screen.getByTestId("bullet-input-1")).toHaveValue("second");
    });

    it("does not remove single non-empty bullet on Backspace", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["something"],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const input = screen.getByTestId("bullet-input-0");
      await userEvent.click(input);
      expect(input).toHaveValue("something");
    });
  });

  describe("recap mode focus", () => {
    it("focuses last bullet when entering recap mode", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["first", "second", "third", ""],
        draftTag: null,
      };
      // The focus target is the composer (the trailing empty slot).

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      await waitFor(() => {
        const lastInput = screen.getByTestId("bullet-input-3");
        expect(lastInput).toHaveFocus();
      });
    });

    it("focuses last bullet in recap with single bullet", async () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      await waitFor(() => {
        const input = screen.getByTestId("bullet-input-0");
        expect(input).toHaveFocus();
      });
    });
  });

  describe("accessibility", () => {
    it("gives every bullet input an accessible name", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["first", "second", ""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      expect(
        screen.getByLabelText("Bullet 1 for this hour"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Bullet 2 for this hour"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("New bullet for this hour"),
      ).toBeInTheDocument();
    });

    it("groups the bullet list under a labelled group", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: [""],
        draftTag: null,
      };

      render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      expect(
        screen.getByRole("group", { name: "Bullets for this hour" }),
      ).toBeInTheDocument();
    });
  });

  describe("marker color is core branding", () => {
    it("stays brand red even when a tag could be inferred", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["read"],
        draftTag: null,
      };

      const { container } = render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const marker = container.querySelector('[data-testid="bullet-marker-0"]');
      expect(marker).toHaveStyle("background-color: #ec3013");
    });

    it("stays brand red with an explicit tag", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["had meeting"],
        draftTag: "Learning",
      };

      const { container } = render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      const marker = container.querySelector('[data-testid="bullet-marker-0"]');
      expect(marker).toHaveStyle("background-color: #ec3013");
    });

    it("stays brand red when the tag changes", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["test"],
        draftTag: "Learning",
      };

      const { container, rerender } = render(
        <BulletJotter timerState={timerState} updateDraft={updateDraft} />,
      );

      let marker = container.querySelector('[data-testid="bullet-marker-0"]');
      expect(marker).toHaveStyle("background-color: #ec3013");

      const updatedState: Partial<UseTimerResult> = {
        mode: "running",
        draftBullets: ["test"],
        draftTag: "Social",
      };

      rerender(
        <BulletJotter timerState={updatedState} updateDraft={updateDraft} />,
      );

      marker = container.querySelector('[data-testid="bullet-marker-0"]');
      expect(marker).toHaveStyle("background-color: #ec3013");
    });
  });
});

describe("empty draft", () => {
  it("renders one empty input when the server draft is an empty array", () => {
    render(
      <BulletJotter
        timerState={{ mode: "running", draftBullets: [] }}
        updateDraft={() => {}}
      />,
    );

    expect(screen.getByTestId("bullet-input-0")).toBeInTheDocument();
  });
});

describe("empty bullet guard", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it("Enter on an empty bullet does not add another", async () => {
    const updateDraft = vi.fn();
    const user = userEvent.setup();
    const { getByTestId } = render(
      <BulletJotter
        timerState={{ mode: "running", draftBullets: [""] }}
        updateDraft={updateDraft}
      />,
    );

    await user.type(getByTestId("bullet-input-0"), "{Enter}");
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it("Enter on a filled composer still commits the next one", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    const { getByTestId } = render(
      <StatefulJotter initial={["did a thing", ""]} spy={spy} />,
    );

    // ["did a thing"] gets a composer appended at index 1; typing then
    // committing appends a fresh empty slot.
    getByTestId("bullet-input-1").focus();
    await user.keyboard("x{Enter}");
    const calls = spy.mock.calls;
    expect(calls[calls.length - 1][0].bullets).toEqual([
      "did a thing",
      "x",
      "",
    ]);
  });
});

describe("composer position", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the composer as the FIRST row so the place to type never moves", () => {
    render(
      <BulletJotter
        timerState={{
          mode: "running",
          draftBullets: ["Asleep (5 min)", "another note", ""],
        }}
        updateDraft={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs[0].value).toBe("");
    expect(inputs[0].placeholder).toBe("Jot it down while it's fresh…");
    expect(inputs[1].value).toBe("Asleep (5 min)");
    expect(inputs[2].value).toBe("another note");
  });
});
