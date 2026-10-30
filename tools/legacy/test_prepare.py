"""Synthetic parser and classification tests; never uses company data."""
import unittest
from prepare import tuples, statements, classify


class PreparationTest(unittest.TestCase):
    def test_mysql_escaping_delimiters_unicode_and_null(self):
        value = "(1,'Kühl; \\'Test\\'','Zeile\\n2',NULL,'C:\\\\tmp'),(2,'a,b','it''s',0,'=SUM(A1)');"
        rows = list(tuples(value))
        self.assertEqual(rows[0], [1, "Kühl; 'Test'", "Zeile\n2", None, 'C:\\tmp'])
        self.assertEqual(rows[1], [2, 'a,b', "it's", 0, '=SUM(A1)'])
        self.assertEqual(len(list(statements("INSERT INTO x VALUES ('a;b');SELECT 1;"))), 2)

    def test_partial_dump_fails(self):
        with self.assertRaises(ValueError):
            list(statements("INSERT INTO x VALUES ('unclosed"))

    def test_series_and_owned_children_but_no_unrelated_siblings(self):
        tables = {'ticket_series': [{'id': 8, 'title': 'Filiale_des_Monats'}],
                  'tickets': [{'id': 1, 'title': 'Termin', 'project_id': None, 'ticket_category_id': 1, 'ticket_series_id': 8},
                              {'id': 2, 'title': 'Andere Arbeit', 'project_id': None, 'ticket_category_id': 1, 'ticket_series_id': None}],
                  'ticket_comments': [{'id': 4, 'ticket_id': 1, 'body': 'Wissen'}],
                  'ticket_assignees': [{'ticket_id': 1, 'user_id': 7}]}
        reasons, uncertain = classify(tables)
        self.assertIn(('ticket_comments', 4), reasons)
        self.assertIn(('ticket_assignees', '1:7'), reasons)
        self.assertNotIn(('tickets', 2), reasons)
        self.assertFalse(uncertain)

    def test_comment_match_includes_owning_ticket(self):
        tables = {'tickets': [{'id': 1, 'title': 'Allgemeine Aktion', 'project_id': None, 'ticket_category_id': 1, 'ticket_series_id': None}],
                  'ticket_comments': [{'id': 4, 'ticket_id': 1, 'body': 'Filiale des Monats'}], 'ticket_assignees': []}
        reasons, _ = classify(tables)
        self.assertIn(('tickets', 1), reasons)


if __name__ == '__main__':
    unittest.main()
