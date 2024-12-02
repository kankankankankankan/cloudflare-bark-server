import {fromHono} from "chanfana";
import {Hono, Context, NotFoundHandler} from "hono";
import {
  dbMiddleware,
  initMiddleware,
  barkResponseMiddleware,
  keyAuthMiddleware
} from "./middlewares"
import {
  PingEndpoint,
  InfoEndpoint,
  CheckEndpoint,
  RegisterEndpoint,
  resolvePushEndPoint
} from "./barks"

import {
  ScheduleCreate,
  ScheduleList,
  ScheduleDelete,
  ScheduleFetch,
  ScheduleUpdate, ScheduleEnable, ScheduleDisable
} from "./endpoints"

// Start a Hono app
const app = new Hono<{
  Bindings: Env
}>();

app.use(initMiddleware)
app.use(barkResponseMiddleware)
app.use("/register/*", dbMiddleware)
app.use("/push", dbMiddleware)
app.use("/:device_key/*", dbMiddleware)
app.use("/api/*", dbMiddleware)

app.get("/schedules", async (c) => c.env.ASSETS.fetch(c.req.raw))

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/docs",
});

// Basic info
openapi.get("/ping", PingEndpoint);
openapi.get("/info", InfoEndpoint);
openapi.get("/healthz", async (c: Context) => c.text("ok"));

// Check and register endpoints
openapi.get("/register/:key", CheckEndpoint);

openapi.get("/register", RegisterEndpoint);
openapi.post("/register", RegisterEndpoint);
openapi.post("/push", resolvePushEndPoint({push: true}));

// Schedule
const schedule = new Hono<{
  Bindings: Env
}>()

schedule.use(keyAuthMiddleware)

const scheduleApi = fromHono(schedule, {
  base: "/api/schedules",
})

scheduleApi.post("/", ScheduleCreate)
scheduleApi.get("/", ScheduleList)
scheduleApi.delete("/:id", ScheduleDelete)
scheduleApi.get("/:id", ScheduleFetch)
scheduleApi.put("/:id", ScheduleUpdate)
scheduleApi.put("/:id/enable", ScheduleEnable)
scheduleApi.put("/:id/disable", ScheduleDisable)

app.route("/api/schedules", schedule)
app.all("/api/*", (c) => c.notFound())
openapi.all("/api/schedules", scheduleApi)


// Send notification
const push = new Hono<{
  Bindings: Env
}>()

push.use(dbMiddleware)

const pushApi = fromHono(push, {
  base: "/:key",
})

pushApi.get('/:category/:title/:body', resolvePushEndPoint({
  category: true,
  title: true,
  body: true,
  get: true
}))
pushApi.post('/:category/:title/:body', resolvePushEndPoint({
  category: true,
  title: true,
  body: true,
  get: false
}))

pushApi.get('/:title/:body', resolvePushEndPoint({
  title: true,
  body: true,
  get: true
}))
pushApi.post('/:title/:body', resolvePushEndPoint({
  title: true,
  body: true,
  get: false
}))

pushApi.get('/:body', resolvePushEndPoint({body: true, get: true}))
pushApi.post('/:body', resolvePushEndPoint({body: true, get: false}))

pushApi.get('/', resolvePushEndPoint({get: true}))
pushApi.post('/', resolvePushEndPoint({get: false}))


app.route("/:device_key", push)
openapi.all("/:device_key", pushApi)

// Export the Hono app
export default app;
