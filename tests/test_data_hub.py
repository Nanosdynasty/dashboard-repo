import tempfile
import unittest
from pathlib import Path

from data_hub import ApiConnectionRequest, DataHubStore, RelationshipRequest


class DataHubStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = DataHubStore(Path(self.temp_dir.name) / "provider_master.sqlite3")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_upload_profiles_and_exports_rows(self):
        content = (
            "period,country,commodity,volume_mt\n"
            "2026-05-01,China,Coal,12.5\n"
            "2026-06-01,China,Coal,13.2\n"
        ).encode()
        dataset = self.store.add_dataset(
            "kpler", "China coal imports", "monthly", "imports.csv", content
        )
        self.assertEqual(dataset["row_count"], 2)
        self.assertIn("period", dataset["date_columns"])
        self.assertIn("volume_mt", dataset["numeric_columns"])
        self.assertEqual(self.store.rows(dataset["id"])[1]["volume_mt"], 13.2)
        self.assertEqual(self.store.summary()["totals"]["datasets"], 1)

    def test_compare_and_approve_relationship(self):
        left = self.store.add_dataset(
            "oceanbolt", "Port calls", "monthly", "calls.csv",
            b"period,country,port,volume_mt\n2026-06-01,China,Qingdao,10\n",
        )
        right = self.store.add_dataset(
            "custom", "Power burn", "monthly", "burn.csv",
            b"period,country,plant,coal_burn_mt\n2026-06-01,China,Plant A,8\n",
        )
        comparison = self.store.compare([left["id"], right["id"]])
        self.assertTrue(comparison["join_ready"])
        self.assertIn("country", comparison["shared_fields"])
        proposal = self.store.propose_relationship(RelationshipRequest(
            dataset_ids=[left["id"], right["id"]], question="Relate imports to burn"
        ))
        self.assertEqual(proposal["status"], "proposed")
        approved = self.store.approve_relationship(proposal["id"], True)
        self.assertEqual(approved["status"], "approved")

    def test_api_key_is_masked_in_persisted_metadata(self):
        connection = self.store.save_connection(ApiConnectionRequest(
            provider="gtt", endpoint_url="https://example.test/api",
            api_key="secret-123456", connection_label="Research",
        ))
        self.assertEqual(connection["key_mask"], "••••3456")
        payload = self.store.summary()["providers"][0]["connection"]
        self.assertNotIn("secret-123456", str(payload))


if __name__ == "__main__":
    unittest.main()
