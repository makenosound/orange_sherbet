import { describe, it, expect, beforeEach } from "vitest";
import { reduce, todomvcViewFn, todoItemViewFn } from "./todomvc.js";
import todoItem from "./compiled/todo_item.js";

// Three independently testable parts: reduce (pure, now including edit mode),
// the root (owns state, reconciles the list by writing each <li>'s
// data-defo-todo-item attribute), and the item (renders its own content +
// editing state from that attribute via update, and emits intents up).

const parse = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const items = (root) => [...root.querySelectorAll(".todo-list li")];
const todoOf = (li) => JSON.parse(li.getAttribute("data-defo-todo-item"));
const count = (root) => root.querySelector(".todo-count")?.textContent.replace(/\s+/g, " ").trim();
const intent = (li, type, detail) =>
  li.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));

describe("reduce (pure state transitions)", () => {
  const base = {
    todos: [{ id: 1, title: "a", completed: false }, { id: 2, title: "b", completed: true }],
    filter: "all",
    editing: null,
  };

  it("adds with the next id", () => expect(reduce(base, { type: "add", title: "c" }).todos.at(-1)).toMatchObject({ id: 3, title: "c", completed: false }));
  it("toggles", () => expect(reduce(base, { type: "toggle", id: 1 }).todos[0].completed).toBe(true));
  it("destroys", () => expect(reduce(base, { type: "destroy", id: 1 }).todos.map((t) => t.id)).toEqual([2]));
  it("toggles all", () => expect(reduce(base, { type: "toggleAll", completed: true }).todos.every((t) => t.completed)).toBe(true));
  it("clears completed", () => expect(reduce(base, { type: "clearCompleted" }).todos.map((t) => t.id)).toEqual([1]));
  it("sets the filter", () => expect(reduce(base, { type: "filter", filter: "active" }).filter).toBe("active"));

  it("starts editing", () => expect(reduce(base, { type: "edit", id: 1 }).editing).toBe(1));
  it("cancels editing", () => expect(reduce({ ...base, editing: 1 }, { type: "cancel" }).editing).toBeNull());
  it("saves the title and clears editing", () => {
    const next = reduce({ ...base, editing: 1 }, { type: "save", id: 1, title: "x" });
    expect(next.todos[0].title).toBe("x");
    expect(next.editing).toBeNull();
  });
  it("clears editing when the edited todo is destroyed", () => {
    expect(reduce({ ...base, editing: 1 }, { type: "destroy", id: 1 }).editing).toBeNull();
    expect(reduce({ ...base, editing: 2 }, { type: "destroy", id: 1 }).editing).toBe(2);
  });
  it("does not mutate its input", () => {
    const before = JSON.stringify(base);
    reduce(base, { type: "toggle", id: 1 });
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("todomvcViewFn (state + list reconciliation)", () => {
  const shell = () => {
    document.body.innerHTML = `
      <section class="todoapp" data-defo-todomvc="{}">
        <header class="header"><input class="new-todo" /></header>
        <section class="main" hidden>
          <input class="toggle-all" type="checkbox" />
          <div class="list-mount"></div>
        </section>
        <div class="footer-mount"></div>
      </section>`;
    const root = document.querySelector(".todoapp");
    todomvcViewFn(root);
    return root;
  };
  const byId = (root, id) => root.querySelector(`li[data-id="${id}"]`);

  beforeEach(() => {
    localStorage.clear();
    location.hash = "";
    document.body.innerHTML = "";
  });

  it("renders each todo as an <li> carrying its state (incl. editing) in the attribute", () => {
    const root = shell();
    expect(items(root).length).toBe(2);
    expect(todoOf(items(root)[0])).toMatchObject({ id: 1, completed: true, editing: false });
    expect(count(root)).toContain("1 item left");
  });

  it("updates the item's attribute when a toggle intent bubbles up", () => {
    const root = shell();
    intent(byId(root, 2), "todo:toggle", { id: 2 });
    expect(todoOf(byId(root, 2)).completed).toBe(true);
    expect(count(root)).toContain("0 items left");
  });

  it("marks an item editing, then saves and clears it", () => {
    const root = shell();
    intent(byId(root, 1), "todo:edit", { id: 1 });
    expect(todoOf(byId(root, 1)).editing).toBe(true);

    intent(byId(root, 1), "todo:save", { id: 1, title: "Renamed" });
    expect(todoOf(byId(root, 1))).toMatchObject({ title: "Renamed", editing: false });
  });

  it("cancels editing without changing the title", () => {
    const root = shell();
    intent(byId(root, 1), "todo:edit", { id: 1 });
    intent(byId(root, 1), "todo:cancel", { id: 1 });
    expect(todoOf(byId(root, 1)).editing).toBe(false);
  });

  it("adds and removes <li>s and filters via the hash", () => {
    const root = shell();
    const input = root.querySelector(".new-todo");
    input.value = "Write a test";
    key(input, "Enter");
    expect(items(root).length).toBe(3);

    intent(byId(root, 1), "todo:destroy", { id: 1 });
    expect(byId(root, 1)).toBeNull();

    location.hash = "#/completed";
    window.dispatchEvent(new Event("hashchange"));
    expect(items(root).every((li) => todoOf(li).completed)).toBe(true);
  });
});

describe("todoItemViewFn (renders content + editing from props; emits intents)", () => {
  let li, api, events;

  const mountItem = (todo) => {
    li = parse(todoItem({ todo: { ...todo, editing: false } }));
    document.body.appendChild(li);
    events = [];
    ["todo:toggle", "todo:destroy", "todo:edit", "todo:save", "todo:cancel"].forEach((type) =>
      li.addEventListener(type, (e) => events.push([type, e.detail])),
    );
    api = todoItemViewFn(li, { ...todo, editing: false });
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("emits todo:toggle / todo:edit from the DOM", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    li.querySelector(".toggle").dispatchEvent(new Event("change", { bubbles: true }));
    li.querySelector("label").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(events).toEqual([["todo:toggle", { id: 7 }], ["todo:edit", { id: 7 }]]);
  });

  it("emits todo:save on Enter and todo:cancel on Escape", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    const edit = li.querySelector(".edit");
    edit.value = "Walk the cat";
    key(edit, "Enter");
    key(edit, "Escape");
    expect(events).toEqual([["todo:save", { id: 7, title: "Walk the cat" }], ["todo:cancel", { id: 7 }]]);
  });

  it("enters edit mode (class + focus) when props.editing flips true", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    api.update({ id: 7, title: "Walk the dog", completed: false, editing: true });
    expect(li.classList.contains("editing")).toBe(true);
    expect(li.querySelector(".edit").value).toBe("Walk the dog");
    expect(document.activeElement).toBe(li.querySelector(".edit"));
  });

  it("does not reset the field on a repeat editing update", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    api.update({ id: 7, title: "Walk the dog", completed: false, editing: true });
    li.querySelector(".edit").value = "half-typed";
    api.update({ id: 7, title: "Walk the dog", completed: false, editing: true });
    expect(li.querySelector(".edit").value).toBe("half-typed");
  });

  it("exits edit and re-renders content when editing flips false", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    api.update({ id: 7, title: "Walk the dog", completed: false, editing: true });
    api.update({ id: 7, title: "Walk the cat", completed: true, editing: false });
    expect(li.classList.contains("editing")).toBe(false);
    expect(li.querySelector("label").textContent).toBe("Walk the cat");
    expect(li.classList.contains("completed")).toBe(true);
  });
});
