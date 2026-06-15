import { describe, it, expect, beforeEach } from "vitest";
import { reduce, dispatch, getState, subscribe, reset } from "./store.js";
import { appViewFn } from "./app.js";
import { newTodoViewFn } from "./new_todo.js";
import { toggleAllViewFn } from "./toggle_all.js";
import { todoItemViewFn } from "./todo_item.js";
import todoItem from "../compiled/todo_item.js";

// Each piece is now its own function. reduce is pure; the store holds state and
// notifies; every view dispatches directly to it (no events). Tests drive each
// view and assert the store and/or the app's render.

const parse = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const todos = () => getState().todos;

beforeEach(() => {
  localStorage.clear();
  location.hash = "";
  document.body.innerHTML = "";
  reset(); // fresh seeded state + no subscribers
});

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
  it("starts/saves/cancels editing", () => {
    expect(reduce(base, { type: "edit", id: 1 }).editing).toBe(1);
    expect(reduce({ ...base, editing: 1 }, { type: "cancel" }).editing).toBeNull();
    const saved = reduce({ ...base, editing: 1 }, { type: "save", id: 1, title: "x" });
    expect(saved.todos[0].title).toBe("x");
    expect(saved.editing).toBeNull();
  });
  it("clears editing when the edited todo is destroyed", () =>
    expect(reduce({ ...base, editing: 1 }, { type: "destroy", id: 1 }).editing).toBeNull());
  it("does not mutate its input", () => {
    const before = JSON.stringify(base);
    reduce(base, { type: "toggle", id: 1 });
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("store", () => {
  it("dispatch reduces state and notifies subscribers", () => {
    reset({ todos: [{ id: 1, title: "a", completed: false }], filter: "all", editing: null });
    const seen = [];
    subscribe((s) => seen.push(s.todos.length));
    dispatch({ type: "add", title: "Another" });
    expect(todos().at(-1).title).toBe("Another");
    expect(seen).toEqual([2]);
  });
});

describe("newTodoViewFn", () => {
  it("dispatches add on Enter and clears the field", () => {
    const input = Object.assign(document.createElement("input"), { className: "new-todo" });
    document.body.appendChild(input);
    newTodoViewFn(input);
    input.value = "Write a test";
    key(input, "Enter");
    expect(todos().at(-1).title).toBe("Write a test");
    expect(input.value).toBe("");
  });
});

describe("toggleAllViewFn", () => {
  it("dispatches toggleAll on change", () => {
    const input = Object.assign(document.createElement("input"), { type: "checkbox", className: "toggle-all" });
    document.body.appendChild(input);
    toggleAllViewFn(input);
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(todos().every((t) => t.completed)).toBe(true);
  });
});

describe("todoItemViewFn", () => {
  const mountItem = (todo) => {
    const li = parse(todoItem({ todo: { ...todo, editing: false } }));
    document.body.appendChild(li);
    const api = todoItemViewFn(li, { ...todo, editing: false });
    return { li, api };
  };

  it("dispatches toggle / edit / save from the DOM", () => {
    reset({ todos: [{ id: 2, title: "b", completed: false }], filter: "all", editing: null });
    const { li } = mountItem({ id: 2, title: "b", completed: false });
    li.querySelector(".toggle").dispatchEvent(new Event("change", { bubbles: true }));
    expect(getState().todos.find((t) => t.id === 2).completed).toBe(true);

    li.querySelector("label").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(getState().editing).toBe(2);

    const edit = li.querySelector(".edit");
    edit.value = "renamed";
    key(edit, "Enter");
    expect(getState().todos.find((t) => t.id === 2).title).toBe("renamed");
    expect(getState().editing).toBeNull();
  });

  it("focuses the field when its props say it's editing", () => {
    const { li, api } = mountItem({ id: 2, title: "b", completed: false });
    api.update({ id: 2, title: "b", completed: false, editing: true });
    expect(document.activeElement).toBe(li.querySelector(".edit"));
  });
});

describe("appViewFn (renders + morphs on store changes)", () => {
  const shell = () => {
    document.body.innerHTML = `
      <section class="todoapp" data-defo-app="{}">
        <header class="header"><input class="new-todo" /></header>
        <section class="main" hidden>
          <input class="toggle-all" type="checkbox" />
          <div class="list-mount"></div>
        </section>
        <div class="footer-mount"></div>
      </section>`;
    const root = document.querySelector(".todoapp");
    appViewFn(root);
    return root;
  };
  const items = (root) => [...root.querySelectorAll(".todo-list li")];
  const byId = (root, id) => root.querySelector(`li[data-id="${id}"]`);

  it("renders the list and re-renders on dispatch", () => {
    reset({
      todos: [{ id: 1, title: "a", completed: false }, { id: 2, title: "b", completed: false }],
      filter: "all",
      editing: null,
    });
    const root = shell();
    expect(items(root).length).toBe(2);
    dispatch({ type: "toggle", id: 2 });
    expect(byId(root, 2).classList.contains("completed")).toBe(true);
    expect(root.querySelector(".todo-count").textContent).toContain("1 item left");
  });

  it("preserves an in-progress edit when another todo changes (morph skip)", () => {
    const root = shell();
    dispatch({ type: "edit", id: 1 });
    byId(root, 1).querySelector(".edit").value = "half-typed";
    dispatch({ type: "toggle", id: 2 });
    expect(byId(root, 1).classList.contains("editing")).toBe(true);
    expect(byId(root, 1).querySelector(".edit").value).toBe("half-typed");
  });
});
