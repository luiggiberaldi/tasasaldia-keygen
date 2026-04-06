export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      response = await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }
    return response;
  },
};
