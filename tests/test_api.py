import unittest

from fastapi.testclient import TestClient

from app import app


class PortApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_reports_port_catalog_and_secret_state(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["version"], "4.0.0")
        self.assertGreaterEqual(payload["ports"]["total"], 3_600)
        self.assertIn("ais_configured", payload)

    def test_facets_and_filtered_port_list(self):
        facets = self.client.get("/api/ports/facets")
        self.assertEqual(facets.status_code, 200)
        self.assertGreater(facets.json()["summary"]["dry_bulk"], 300)

        response = self.client.get(
            "/api/ports",
            params={"categories": "dry_bulk", "min_channel_m": 10, "limit": 25},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertLessEqual(len(payload["data"]), 25)
        self.assertTrue(payload["data"])
        self.assertTrue(
            all("dry_bulk" in port["categories"] for port in payload["data"])
        )
        self.assertTrue(
            all(port["channel_depth_m"] >= 10 for port in payload["data"])
        )

    def test_port_detail_and_unknown_port(self):
        listing = self.client.get(
            "/api/ports", params={"categories": "dry_bulk", "limit": 1}
        ).json()
        port_id = listing["data"][0]["id"]
        detail = self.client.get(f"/api/ports/{port_id}")
        self.assertEqual(detail.status_code, 200)
        self.assertIn("sources", detail.json())
        self.assertIn("facilities", detail.json())

        missing = self.client.get("/api/ports/not-a-real-port")
        self.assertEqual(missing.status_code, 404)

    def test_invalid_export_tracker_is_rejected(self):
        response = self.client.get("/api/export/not-a-real-tracker")
        self.assertEqual(response.status_code, 404)

    def test_uploaded_bundle_map_layers_are_available(self):
        expected = {
            "coal_mines": 5_382,
            "iron_ore_mines": 949,
            "steel_plants": 1_293,
            "cement_plants": 3_513,
            "geothermal": 835,
            "bioenergy": 4_537,
            "coal_trade_terminals": 519,
        }
        for layer, count in expected.items():
            with self.subTest(layer=layer):
                response = self.client.get(
                    f"/api/map/{layer}", params={"limit": 150_000}
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.json()), count)

    def test_layer_facets_support_country_status_and_terminal_role_filters(self):
        energy = self.client.get(
            "/api/layer-facets",
            params={"trackers": "coal_plants,solar,wind,hydro,nuclear"},
        )
        self.assertEqual(energy.status_code, 200)
        energy_payload = energy.json()
        self.assertIn("India", {item["id"] for item in energy_payload["countries"]})
        self.assertIn(
            "operating", {item["id"] for item in energy_payload["statuses"]}
        )

        commodities = self.client.get(
            "/api/layer-facets",
            params={
                "trackers": "coal_mines,coal_trade_terminals,iron_ore_mines,steel_plants"
            },
        )
        self.assertEqual(commodities.status_code, 200)
        commodity_payload = commodities.json()
        countries = {item["id"] for item in commodity_payload["countries"]}
        terminal_types = {item["id"] for item in commodity_payload["asset_types"]}
        self.assertTrue({"Australia", "China", "India"}.issubset(countries))
        self.assertIn("Exports", terminal_types)
        self.assertIn("Imports", terminal_types)

    def test_country_and_status_filters_are_applied_to_map_layers(self):
        response = self.client.get(
            "/api/map/coal_mines",
            params={"country": "India", "status": "operating", "limit": 150_000},
        )
        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertTrue(rows)
        self.assertTrue(all(row["country"] == "India" for row in rows))
        self.assertTrue(all(row["status"].lower() == "operating" for row in rows))

    def test_india_coal_workspace_uses_verified_assets_without_fake_metrics(self):
        summary = self.client.get("/api/coal/summary")
        self.assertEqual(summary.status_code, 200)
        payload = summary.json()
        self.assertEqual(payload["country"], "India")
        self.assertGreater(payload["map_assets"]["coal_mines"], 0)
        self.assertGreater(payload["map_assets"]["coal_trade_terminals"], 0)
        self.assertIn(payload["status"], {"awaiting_data", "ready"})
        self.assertIn("quality_note", payload)
        stock_cover = payload["metric_definitions"]["stock_cover_days"]
        self.assertEqual(stock_cover["unit"], "days")
        self.assertIn("average daily coal consumption", stock_cover["formula"])

        assets = self.client.get(
            "/api/coal/assets", params={"asset_kind": "coal_mines"}
        )
        self.assertEqual(assets.status_code, 200)
        asset_payload = assets.json()
        self.assertTrue(asset_payload["data"])
        self.assertTrue(
            all(row["country"] == "India" for row in asset_payload["data"])
        )

    def test_port_ui_does_not_advertise_unsupported_zero_categories(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.text
        self.assertIn('data-mode="coal"', html)
        self.assertNotIn("<span>Oil terminal</span>", html)
        self.assertNotIn("<span>Container</span>", html)
        self.assertNotIn("<span>Liquid bulk</span>", html)
        self.assertNotIn("<span>LNG</span>", html)
        self.assertIn("Stock cover", html)
        self.assertIn("Trade flows", html)

    def test_map_uses_only_explicit_english_labels(self):
        response = self.client.get("/static/js/app.js")
        self.assertEqual(response.status_code, 200)
        javascript = response.text
        self.assertIn('["Africa", 7, 20]', javascript)
        self.assertIn('["South America", -18, -59]', javascript)
        self.assertNotIn("World_Light_Gray_Reference", javascript)
        self.assertNotIn("event.preventDefault()", javascript)


if __name__ == "__main__":
    unittest.main()
