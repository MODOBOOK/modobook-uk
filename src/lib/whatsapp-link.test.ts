import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappLink } from "./whatsapp-link";

test("UK local numbers open an international WhatsApp chat", () => {
  assert.equal(whatsappLink("07511 020876"), "https://wa.me/447511020876");
  assert.equal(whatsappLink("(07511) 020-876"), "https://wa.me/447511020876");
});

test("international numbers retain their country code", () => {
  for (const phone of ["+44 7511 020876", "0044 7511 020876", "447511020876", "+44 (0)7511 020876"]) {
    assert.equal(whatsappLink(phone), "https://wa.me/447511020876");
  }
  assert.equal(whatsappLink("+1 (202) 555-0123"), "https://wa.me/12025550123");
});

test("form and payment messages remain encoded in the chat link", () => {
  assert.equal(whatsappLink("07511020876", "Payment link: https://example.com/?a=1&b=2"),
    "https://wa.me/447511020876?text=Payment%20link%3A%20https%3A%2F%2Fexample.com%2F%3Fa%3D1%26b%3D2");
});

test("invalid phone fields never become WhatsApp handles or bogus numbers", () => {
  for (const phone of [null, undefined, "", "123", "afd2020@outlookcom", "@07511020876"]) {
    assert.equal(whatsappLink(phone), null);
  }
});