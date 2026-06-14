import { describe, it, expect, beforeEach } from "vitest";
import { reduce, todomvcViewFn, todoItemViewFn } from "./todomvc.js";
import todoItem from "./compiled/todo_item.js";

// reduce is pure; the root renders the whole list and morphs it (so its DOM
// updates are synchronous and assertable here); the item handles behaviour and
// focus. In the browser defo binds the item views to the <li>s morph creates.

const parse = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const items = (root) => [...root.querySelectorAll(".todo-list li")];
const byId = (root, id) => root.querySelector(`li[data-id="${id}"]`);
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
  it("saves and clears editing", () => {
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

describe("todomvcViewFn (renders + morphs the list)", () => {
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

  beforeEach(() => {
    localStorage.clear();
    location.hash = "";
    document.body.innerHTML = "";
  });

  it("renders the seeded todos with content and the active count", () => {
    const root = shell();
    expect(items(root).length).toBe(2);
    expect(byId(root, 1).querySelector("label").textContent).toBe("Taste the orange sherbet");
    expect(byId(root, 1).classList.contains("completed")).toBe(true);
    expect(count(root)).toContain("1 item left");
  });

  it("re-renders an item on a toggle intent (via morph)", () => {
    const root = shell();
    intent(byId(root, 2), "todo:toggle", { id: 2 });
    expect(byId(root, 2).classList.contains("completed")).toBe(true);
    expect(byId(root, 2).querySelector(".toggle").checked).toBe(true);
    expect(count(root)).toContain("0 items left");
  });

  it("marks editing, then saves the new title and clears editing", () => {
    const root = shell();
    intent(byId(root, 1), "todo:edit", { id: 1 });
    expect(byId(root, 1).classList.contains("editing")).toBe(true);

    intent(byId(root, 1), "todo:save", { id: 1, title: "Renamed" });
    expect(byId(root, 1).querySelector("label").textContent).toBe("Renamed");
    expect(byId(root, 1).classList.contains("editing")).toBe(false);
  });

  it("preserves an in-progress edit when another todo changes (morph skip)", () => {
    const root = shell();
    intent(byId(root, 1), "todo:edit", { id: 1 });
    byId(root, 1).querySelector(".edit").value = "half-typed";

    intent(byId(root, 2), "todo:toggle", { id: 2 });

    expect(byId(root, 1).classList.contains("editing")).toBe(true);
    expect(byId(root, 1).querySelector(".edit").value).toBe("half-typed");
    expect(byId(root, 2).classList.contains("completed")).toBe(true);
  });

  it("adds and removes <li>s and filters via the hash", () => {
    const root = shell();
    const input = root.querySelector(".new-todo");
    input.value = "Write a test";
    key(input, "Enter");
    expect(items(root).length).toBe(3);
    expect(byId(root, 3).querySelector("label").textContent).toBe("Write a test");

    intent(byId(root, 1), "todo:destroy", { id: 1 });
    expect(byId(root, 1)).toBeNull();

    location.hash = "#/completed";
    window.dispatchEvent(new Event("hashchange"));
    expect(items(root).every((li) => li.classList.contains("completed"))).toBe(true);
  });
});

describe("todoItemViewFn (behaviour + focus)", () => {
  let li, api, events;

  const mountItem = (todo, editing = false) => {
    li = parse(todoItem({ todo: { ...todo, editing } }));
    document.body.appendChild(li);
    events = [];
    ["todo:toggle", "todo:destroy", "todo:edit", "todo:save", "todo:cancel"].forEach((type) =>
      li.addEventListener(type, (e) => events.push([type, e.detail])),
    );
    api = todoItemViewFn(li, { ...todo, editing });
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("emits intents from DOM interactions", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    li.querySelector(".toggle").dispatchEvent(new Event("change", { bubbles: true }));
    li.querySelector("label").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(events).toEqual([["todo:toggle", { id: 7 }], ["todo:edit", { id: 7 }]]);
  });

  it("emits todo:save on Enter and todo:cancel on Escape", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false }, true);
    const edit = li.querySelector(".edit");
    edit.value = "Walk the cat";
    key(edit, "Enter");
    key(edit, "Escape");
    expect(events).toEqual([["todo:save", { id: 7, title: "Walk the cat" }], ["todo:cancel", { id: 7 }]]);
  });

  it("focuses the field when its props say it's editing", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false }, true);
    api.update({ id: 7, title: "Walk the dog", completed: false, editing: true });
    expect(document.activeElement).toBe(li.querySelector(".edit"));
  });

  it("does nothing on update when not editing", () => {
    mountItem({ id: 7, title: "Walk the dog", completed: false });
    api.update({ id: 7, title: "Walk the dog", completed: false, editing: false });
    expect(document.activeElement).not.toBe(li.querySelector(".edit"));
  });
});
