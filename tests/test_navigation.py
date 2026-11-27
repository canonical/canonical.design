import importlib
import os
import unittest
from html.parser import HTMLParser

os.environ.setdefault("SECRET_KEY", "navigation-test")
os.environ.setdefault("DISABLE_SSO", "true")

app_module = importlib.import_module("webapp.app")
app = app_module.app
resolve_navigation = app_module.resolve_navigation


class NavigationParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_sidebar = False
        self.links = []
        self.expand_buttons = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "aside" and "l-docs__sidebar" in attrs.get("class", ""):
            self.in_sidebar = True
        if tag == "a":
            self.links.append((self.in_sidebar, attrs))
        if self.in_sidebar and tag == "button":
            self.expand_buttons.append(attrs)

    def handle_endtag(self, tag):
        if tag == "aside":
            self.in_sidebar = False


class NavigationTests(unittest.TestCase):
    def test_resolve_relative_and_absolute_children(self):
        pages = resolve_navigation(
            [
                {
                    "href": "/brand",
                    "children": [
                        {"href": "/"},
                        {"href": "/logos"},
                        {"href": "/brand/ubuntu-sans", "absolute": True},
                    ],
                }
            ]
        )
        self.assertEqual(
            [page["url"] for page in pages[0]["children"]],
            ["/brand", "/brand/logos", "/brand/ubuntu-sans"],
        )

    def test_typeface_is_reachable_and_selected_in_brand_navigation(self):
        with app.test_client() as client:
            response = client.get("/brand/ubuntu-sans")
        self.assertEqual(response.status_code, 200)
        parser = NavigationParser()
        parser.feed(response.get_data(as_text=True))
        links = [
            (sidebar, attrs)
            for sidebar, attrs in parser.links
            if attrs.get("href") == "/brand/ubuntu-sans"
        ]
        self.assertEqual({sidebar for sidebar, _ in links}, {False, True})
        self.assertTrue(
            any(
                sidebar and attrs.get("aria-current") == "page"
                for sidebar, attrs in links
            )
        )
        self.assertTrue(
            any(
                attrs.get("aria-label") == "Hide submenu for Typography"
                and attrs.get("aria-expanded") == "true"
                for attrs in parser.expand_buttons
            )
        )

    def test_typography_is_not_open_on_other_brand_pages(self):
        with app.test_client() as client:
            response = client.get("/brand/logos")
        self.assertEqual(response.status_code, 200)
        parser = NavigationParser()
        parser.feed(response.get_data(as_text=True))
        self.assertTrue(
            any(
                attrs.get("aria-label") == "Show submenu for Typography"
                and attrs.get("aria-expanded") == "false"
                for attrs in parser.expand_buttons
            )
        )


if __name__ == "__main__":
    unittest.main()
