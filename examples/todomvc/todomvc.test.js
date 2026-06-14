import { describe, it, expect, beforeEach } from "vitest";
import { todomvcViewFn, todoItemViewFn } from "./todomvc.js";
import todoItem from "./compiled/todo_item.js";

// The two view functions are tested independently. todoItemViewFn turns DOM
// interactions into bubbling intents; todomvcViewFn owns state and renders
// (via morph) in response to those intents. defo is what wires them together in
// the browser — here we drive each side directly.

const parse = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("todoItemViewFn", () => {
  let li, events;

  beforeEach(() => {
    document.body.innerHTML = "";
    li = parse(todoItem({ todo: { id: 7, title: "Walk the dog", completed: false } }));
    document.body.appendChild(li);
    events = [];
    ["todo:toggle", "todo:destroy", "todo:save"].forEach((type) =>
      li.addEventListener(type, (e) => events.push([type, e.detail])),
    );
    todoItemViewFn(li);
  });

  it("emits todo:toggle when the checkbox changes", () => {
    li.querySelector(".toggle").dispatchEvent(new Event("change", { bubbles: true }));
    expect(events).toEqual([["todo:toggle", { id: 7 }]]);
  });

  it("emits todo:destroy when the destroy button is clicked", () => {
    li.querySelector(".destroy").dispatchEvent(new Event("click", { bubbles: true }));
    expect(events).toEqual([["todo:destroy", { id: 7 }]]);
  });

  it("enters edit mode on double-click and saves on Enter", () => {
    li.querySelector("label").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(li.classList.contains("editing")).toBe(true);
    expect(li.hasAttribute("data-editing")).toBe(true);

    const edit = li.querySelector(".edit");
    edit.value = "Walk the cat";
    key(edit, "Enter");

    expect(events).toEqual([["todo:save", { id: 7, title: "Walk the cat" }]]);
    expect(li.classList.contains("editing")).toBe(false);
  });

  it("cancels an edit on Escape without emitting", () => {
    li.querySelector("label").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const edit = li.querySelector(".edit");
    edit.value = "changed";
    key(edit, "Escape");
    expect(events).toEqual([]);
    expect(li.classList.contains("editing")).toBe(false);
    expect(edit.value).toBe("Walk the dog");
  });
});

describe("todomvcViewFn", () => {
  const mount = () => {
    document.body.innerHTML = `
      <section class="todoapp" data-defo-todomvc="{}">
        <header class="header"><input class="new-todo" /></header>
        <section class="main" hidden>
          <input id="toggle-all" class="toggle-all" type="checkbox" />
          <div class="list-mount"></div>
        </section>
        <div class="footer-mount"></div>
      </section>`;
    const root = document.querySelector(".todoapp");
    todomvcViewFn(root);
    return root;
  };

  const items = (root) => [...root.querySelectorAll(".todo-list li")];
  const byId = (root, id) => root.querySelector(`li[data-id="${id}"]`);
  const count = (root) => root.querySelector(".todo-count").textContent.replace(/\s+/g, " ").trim();
  const intent = (li, type, detail) =>
    li.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));

  beforeEach(() => {
    localStorage.clear();
    location.hash = "";
    document.body.innerHTML = "";
  });

  it("renders the seeded todos with the active count", () => {
    const root = mount();
    expect(items(root).length).toBe(2);
    expect(count(root)).toContain("1 item left");
  });

  it("toggles a todo from a bubbled intent", () => {
    const root = mount();
    intent(byId(root, 2), "todo:toggle", { id: 2 });
    expect(count(root)).toContain("0 items left");
    expect(byId(root, 2).classList.contains("completed")).toBe(true);
  });

  it("saves an edited title from a bubbled intent", () => {
    const root = mount();
    intent(byId(root, 1), "todo:save", { id: 1, title: "Renamed" });
    expect(byId(root, 1).textContent).toContain("Renamed");
  });

  it("destroys a todo from a bubbled intent", () => {
    const root = mount();
    intent(byId(root, 1), "todo:destroy", { id: 1 });
    expect(items(root).length).toBe(1);
    expect(byId(root, 1)).toBeNull();
  });

  it("adds a todo on Enter in the new-todo input", () => {
    const root = mount();
    const input = root.querySelector(".new-todo");
    input.value = "Write a test";
    key(input, "Enter");
    expect(items(root).length).toBe(3);
    expect(items(root).at(-1).textContent).toContain("Write a test");
  });

  it("clears completed and filters via the hash", () => {
    const root = mount();
    root.querySelector(".clear-completed").dispatchEvent(new Event("click", { bubbles: true }));
    expect(items(root).length).toBe(1); // the one active seed remains

    intent(byId(root, 2), "todo:toggle", { id: 2 }); // complete it
    location.hash = "#/active";
    window.dispatchEvent(new Event("hashchange"));
    expect(items(root).length).toBe(0);
  });

  it("leaves an item being edited untouched when another re-render happens", () => {
    const root = mount();
    // Simulate item 1 mid-edit: mark it and change its edit field, as the item
    // viewFn would.
    const editing = byId(root, 1);
    editing.classList.add("editing");
    editing.setAttribute("data-editing", "");
    editing.querySelector(".edit").value = "half-typed";

    // A re-render triggered by another todo must not clobber the edit.
    intent(byId(root, 2), "todo:toggle", { id: 2 });

    const stillEditing = byId(root, 1);
    expect(stillEditing.hasAttribute("data-editing")).toBe(true);
    expect(stillEditing.querySelector(".edit").value).toBe("half-typed");
  });
});
