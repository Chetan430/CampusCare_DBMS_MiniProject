"""Offline source-structure regression checks. These DO NOT replace live tests."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

def read(name): return (ROOT / name).read_text(encoding="utf-8")

class TestLevel3Repository(unittest.TestCase):
    def test_eight_models(self):
        content = read('prisma/schema.prisma')
        self.assertEqual(len(re.findall(r'^model\s+\w+\s*\{', content, re.M)), 8)
        for name in ('User','Location','Category','Ticket','Assignment','StatusHistory','Feedback','DuplicateLink'):
            self.assertRegex(content, rf'model {name}\s*\{{')

    def test_native_uuid_fields(self):
        content = read('prisma/schema.prisma')
        self.assertEqual(len(re.findall(r'@id @default\(uuid\(\)\) @db\.Uuid',content)),8)
        self.assertIn('ticketId    String   @unique @map("ticket_id") @db.Uuid', content)

    def test_two_triggers_assignment_function(self):
        source = read('sql/002_triggers_and_procedures.sql')
        for phrase in ('trg_set_sla_due','trg_log_status_change','auto_assign_technician','app.actor_id','app.status_note','FOR UPDATE OF t'):
            self.assertIn(phrase,source)

    def test_vector_and_integrity(self):
        source=read('sql/001_vector_and_indexes.sql')
        for phrase in ('CREATE EXTENSION IF NOT EXISTS vector','vector(384)','USING hnsw','idx_one_active_assignment','chk_feedback_rating'):
            self.assertIn(phrase,source)

    def test_views(self):
        source=read('sql/003_views.sql')
        for name in ('technician_workload','sla_breach_report','recurring_issue_hotspots'):
            self.assertIn(name,source)
        self.assertIn('HAVING COUNT',source)

    def test_demo_sql(self):
        source=read('sql/004_demonstration_queries.sql')
        for word in ('SELECT','INSERT','UPDATE','DELETE','GROUP BY','HAVING','ORDER BY','CREATE TABLE','ALTER TABLE','DROP TABLE','ROLLBACK'):
            self.assertIn(word,source)

    def test_auth_and_validation(self):
        routes=read('app/api/tickets/route.ts')
        self.assertIn('getServerSession',routes)
        self.assertIn('createSchema.safeParse',routes)
        self.assertIn('role !== "requester"',routes)
        self.assertIn('await tx.$queryRaw',read('lib/tickets.ts'))
        self.assertIn('DELETE',read('app/api/tickets/[id]/feedback/route.ts'))

    def test_real_frontend_form_and_demo_assets(self):
        page=read('app/dashboard/requester/page.tsx')
        self.assertIn('categories.map',page)
        self.assertIn('value={form.building}',page)
        self.assertIn('categoryName',read('app/api/tickets/route.ts'))
        self.assertIn('possibleDuplicates',read('lib/tickets.ts'))
        for name in ('ER_DIAGRAM.png','ARCHITECTURE.png','DEMO_RUNBOOK.md'):
            self.assertTrue((ROOT/'docs'/name).is_file(),name)

if __name__=='__main__':unittest.main(verbosity=2)
