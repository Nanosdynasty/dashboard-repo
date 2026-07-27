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
        }
        for layer, count in expected.items():
            with self.subTest(layer=layer):
                response = self.client.get(
                    f"/api/map/{layer}", params={"limit": 150_000}
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.json()), count)


if __name__ == "__main__":
    unittest.main()
