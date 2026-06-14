// TodoMVC: the root renders the whole list and morphs it; defo + morphlex own
// the DOM reconciliation; edit mode lives in the reducer state.
//
//   todomvcViewFn  the root. Owns state (a closure) + a pure reduce. Takes
//                  bubbling intents (the main reducer is event-driven), renders
//                  the full <ul> from the templates, and morphs it onto the live
//                  list — morphlex handles add/remove/reorder/attribute updates,
//                  and skips a todo that's being edited so the in-progress edit
//                  survives an unrelated re-render.
//
//   todoItemViewFn defo binds it to each <li> as morph adds them. It owns one
//                  todo's behaviour (toggle / destroy / edit) — emitting intents
//                  up — and focuses the field when its props say it's editing.
//                  It holds no state and renders no content (morph does that).
//
//   reduce         pure state transitions, including edit mode.
//
// @icelab/defo and morphlex resolve via the import map in index.html (and
// node_modules under test).
import { morph } from "morphlex";
import todoList from "./compiled/todo_list.js";
import todoFooter from "./compiled/todo_footer.js";

const STORAGE_KEY = "orange-sherbet-todomvc";

const seedTodos = () => [
  { id: 1, title: "Taste the orange sherbet", completed: true },
  { id: 2, title: "Render this list with Orange Sherbet", completed: false },
];

const loadTodos = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? seedTodos();
  } catch {
    return seedTodos();
  }
};

const filterFromHash = () => {
  const hash = location.hash.replace(/^#\//, "");
  return hash === "active" || hash === "completed" ? hash : "all";
};

const nextId = (todos) => todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;

const visible = (state) =>
  state.todos.filter((t) =>
    state.filter === "active" ? !t.completed : state.filter === "completed" ? t.completed : true,
  );

const parse = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

const isEditing = (node) => node.nodeType === 1 && node.classList.contains("editing");

// --- pure state transitions ------------------------------------------------

export const reduce = (state, action) => {
  switch (action.type) {
    case "add":
      return {
        ...state,
        todos: [...state.todos, { id: nextId(state.todos), title: action.title, completed: false }],
      };
    case "toggle":
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, completed: !t.completed } : t)),
      };
    case "edit":
      return { ...state, editing: action.id };
    case "cancel":
      return { ...state, editing: null };
    case "save":
      return {
        ...state,
        editing: null,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, title: action.title } : t)),
      };
    case "destroy":
      return {
        ...state,
        editing: state.editing === action.id ? null : state.editing,
        todos: state.todos.filter((t) => t.id !== action.id),
      };
    case "toggleAll":
      return { ...state, todos: state.todos.map((t) => ({ ...t, completed: action.completed })) };
    case "clearCompleted":
      return { ...state, todos: state.todos.filter((t) => !t.completed) };
    case "filter":
      return { ...state, filter: action.filter };
    default:
      return state;
  }
};

// --- per-item view: behaviour + focus, no content --------------------------

export const todoItemViewFn = (li, props) => {
  const id = props.id;
  const emit = (type, detail) => li.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  const editValue = () => li.querySelector(".edit").value.trim();

  const onChange = (event) => {
    if (event.target.matches(".toggle")) emit("todo:toggle", { id });
  };
  const onClick = (event) => {
    if (event.target.matches(".destroy")) emit("todo:destroy", { id });
  };
  const onDblclick = (event) => {
    if (event.target.matches("label")) emit("todo:edit", { id });
  };
  const onKeydown = (event) => {
    if (!event.target.matches(".edit")) return;
    if (event.key === "Enter") emit("todo:save", { id, title: editValue() });
    else if (event.key === "Escape") emit("todo:cancel", { id });
  };
  const onBlur = (event) => {
    // Commit on blur, but not the blur caused by morph removing the field on
    // exit — by then the .editing class is gone.
    if (event.target.matches(".edit") && li.classList.contains("editing")) {
      emit("todo:save", { id, title: editValue() });
    }
  };

  li.addEventListener("change", onChange);
  li.addEventListener("click", onClick);
  li.addEventListener("dblclick", onDblclick);
  li.addEventListener("keydown", onKeydown);
  li.addEventListener("blur", onBlur, true);

  return {
    // morph renders the content; defo calls this when the attribute changes.
    // The only thing morph can't do is focus, so that's all the item does.
    update(todo) {
      if (!todo.editing) return;
      const edit = li.querySelector(".edit");
      if (edit && document.activeElement !== edit) {
        edit.focus();
        edit.setSelectionRange(edit.value.length, edit.value.length);
      }
    },
    destroy() {
      li.removeEventListener("change", onChange);
      li.removeEventListener("click", onClick);
      li.removeEventListener("dblclick", onDblclick);
      li.removeEventListener("keydown", onKeydown);
      li.removeEventListener("blur", onBlur, true);
    },
  };
};

// --- root view: state + reducer + morph ------------------------------------

export const todomvcViewFn = (root) => {
  let state = { todos: loadTodos(), filter: filterFromHash(), editing: null };

  const listMount = root.querySelector(".list-mount");
  const footerMount = root.querySelector(".footer-mount");
  const main = root.querySelector(".main");
  const toggleAll = root.querySelector(".toggle-all");
  const newTodo = root.querySelector(".new-todo");

  const ensureList = () => {
    let ul = listMount.querySelector(".todo-list");
    if (!ul) {
      ul = document.createElement("ul");
      ul.className = "todo-list";
      listMount.appendChild(ul);
    }
    return ul;
  };

  const render = () => {
    const has = state.todos.length > 0;
    const active = state.todos.filter((t) => !t.completed).length;
    main.hidden = !has;
    footerMount.innerHTML = has
      ? todoFooter({ active, filter: state.filter, has_completed: state.todos.some((t) => t.completed) })
      : "";
    toggleAll.checked = has && active === 0;

    // Render the whole list and let morphlex reconcile it. Each todo's props —
    // including whether it's the one being edited — go into the <li>'s attribute,
    // and defo binds/updates the item views as nodes enter/change.
    const todos = visible(state).map((t) => ({ ...t, editing: t.id === state.editing }));
    morph(ensureList(), parse(todoList({ todos })), {
      beforeNodeVisited: (from, to) => !(isEditing(from) && isEditing(to)),
    });
  };

  const dispatch = (action) => {
    state = reduce(state, action);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
    render();
  };

  const onToggle = (event) => dispatch({ type: "toggle", id: event.detail.id });
  const onEdit = (event) => dispatch({ type: "edit", id: event.detail.id });
  const onCancel = () => dispatch({ type: "cancel" });
  const onSave = (event) => {
    const { id, title } = event.detail;
    dispatch(title ? { type: "save", id, title } : { type: "destroy", id });
  };
  const onDestroy = (event) => dispatch({ type: "destroy", id: event.detail.id });
  const onKeydown = (event) => {
    if (event.target.matches(".new-todo") && event.key === "Enter") {
      const title = event.target.value.trim();
      if (!title) return;
      dispatch({ type: "add", title });
      event.target.value = "";
    }
  };
  const onChange = (event) => {
    if (event.target.matches(".toggle-all")) dispatch({ type: "toggleAll", completed: event.target.checked });
  };
  const onClick = (event) => {
    if (event.target.matches(".clear-completed")) dispatch({ type: "clearCompleted" });
  };
  const onHashchange = () => dispatch({ type: "filter", filter: filterFromHash() });

  root.addEventListener("todo:toggle", onToggle);
  root.addEventListener("todo:edit", onEdit);
  root.addEventListener("todo:cancel", onCancel);
  root.addEventListener("todo:save", onSave);
  root.addEventListener("todo:destroy", onDestroy);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHashchange);

  render();
  newTodo.focus();

  return {
    destroy() {
      root.removeEventListener("todo:toggle", onToggle);
      root.removeEventListener("todo:edit", onEdit);
      root.removeEventListener("todo:cancel", onCancel);
      root.removeEventListener("todo:save", onSave);
      root.removeEventListener("todo:destroy", onDestroy);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashchange);
    },
  };
};
