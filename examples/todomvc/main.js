// Entry point: bind the TodoMVC viewFn to the page with defo, exactly as this
// repo's app.ts does for its views. Kept separate from todomvc.js so the viewFn
// has no CDN dependency and can be tested in isolation.
import defo from "https://esm.sh/@icelab/defo@1";
import { todomvcViewFn } from "./todomvc.js";

defo({ views: { todomvc: todomvcViewFn } });
