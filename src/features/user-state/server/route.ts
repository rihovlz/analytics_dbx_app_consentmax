import { z } from "zod";
import { withApiRoute } from "@/lib/http/with-api-route";
import { parseInput, readMutation, resolveOwner } from "./request";
import type { UserStateConfig } from "./config";
import type { UserStateService } from "./service";

type Runtime = (requestId: string) => { config: UserStateConfig; service: UserStateService };
type Params = { params: Promise<{ id: string }> };

// Apply privacy headers to successes AND the common withApiRoute error envelope.
function privateRoute<Context>(handler: (request: Request, context: Context) => Promise<Response>) {
  return async (request: Request, context: Context): Promise<Response> => {
    const response = await handler(request, context);
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("vary", "Cookie, x-forwarded-user");
    return response;
  };
}

export function userStateRoutes(runtime: Runtime) {
  const resolve = (request: Request, requestId: string) => {
    const { config, service } = runtime(requestId);
    return { config, service, owner: resolveOwner(request, config) };
  };
  return {
    list: privateRoute(withApiRoute(async (request, context) => {
      const { service, owner } = resolve(request, context.requestId);
      return service.list(owner, new URL(request.url).searchParams.get("cursor") ?? "");
    })),
    get: privateRoute(withApiRoute<unknown, Params>(async (request, context, route) => {
      const { service, owner } = resolve(request, context.requestId);
      return service.get(owner, (await route.params).id);
    })),
    put: privateRoute(withApiRoute<unknown, Params>(async (request, context, route) => {
      const { config, service, owner } = resolve(request, context.requestId);
      return service.put(owner, (await route.params).id, await readMutation(request, config));
    })),
    remove: privateRoute(withApiRoute<unknown, Params>(async (request, context, route) => {
      const { config, service, owner } = resolve(request, context.requestId);
      parseInput(z.object({}).strict(), await readMutation(request, config));
      await service.remove(owner, (await route.params).id);
      return { deleted: true };
    })),
    preferences: privateRoute(withApiRoute(async (request, context) => {
      const { service, owner } = resolve(request, context.requestId);
      return service.preferences(owner);
    })),
    putPreferences: privateRoute(withApiRoute(async (request, context) => {
      const { config, service, owner } = resolve(request, context.requestId);
      return service.putPreferences(owner, await readMutation(request, config));
    })),
  };
}
