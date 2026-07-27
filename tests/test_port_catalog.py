import unittest

from app import ports


class PortCatalogQualityTests(unittest.TestCase):
    def test_catalog_has_unique_valid_ports(self):
        self.assertGreaterEqual(len(ports.ports), 3_600)
        ids = [port["id"] for port in ports.ports]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(
            all(
                -90 <= port["lat"] <= 90 and -180 <= port["lon"] <= 180
                for port in ports.ports
            )
        )

    def test_depth_and_dry_bulk_coverage_are_nontrivial(self):
        self.assertGreater(ports.summary["with_channel_depth"], 3_000)
        self.assertGreater(ports.summary["with_cargo_depth"], 3_000)
        self.assertGreater(ports.summary["dry_bulk"], 300)

    def test_coal_matches_respect_geographic_guardrail(self):
        links = [
            terminal
            for port in ports.ports
            for terminal in port["coal_terminals"]
        ]
        self.assertGreater(len(links), 500)
        self.assertLessEqual(max(link["distance_km"] for link in links), 50)
        self.assertTrue(
            all(link["match_confidence"] in {"high", "medium"} for link in links)
        )

    def test_unknown_values_are_not_coerced_to_zero(self):
        missing_draft = [
            port for port in ports.ports if port["max_vessel_draft_m"] is None
        ]
        self.assertTrue(missing_draft)
        self.assertTrue(
            all(port["max_vessel_draft_m"] is None for port in missing_draft)
        )


if __name__ == "__main__":
    unittest.main()
