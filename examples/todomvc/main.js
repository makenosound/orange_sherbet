// Entry point: register the view functions with defo, exactly as this repo's
// app.ts does. defo binds `todomvc` to the root and `todoItem` to each <li> as
// it enters the DOM (including the ones the root's morph adds on re-render).
import defo from "@icelab/defo";
import { todomvcViewFn, todoItemViewFn } from "./todomvc.js";

defo({ views: { todomvc: todomvcViewFn, todoItem: todoItemViewFn } });
