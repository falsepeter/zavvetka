const DONATION_URL = "https://yoomoney.ru/to/4100119459265589/0";

export default {
  fetch(): Response {
    return Response.redirect(DONATION_URL, 302);
  },
};
