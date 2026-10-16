import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('importer',Path(__file__).resolve().parents[1]/'scripts/import-print-estimates.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Totals(unittest.TestCase):
 def test_multicolor_total(self):self.assertEqual(m.gcode_stats('; total estimated time: 1d 2h 3m 4s\n; total filament weight [g] : 12.5,20.25,1.0\n'),(33.75,93784))
 def test_profile_weight_fallback(self):self.assertEqual(m.gcode_stats('; total estimated time: 12m 3s\n; total filament weight [g] : \n',4.24),(4.24,723))
 def test_missing_not_guessed(self):
  for s in ['', '; model printing time: 3h\n; total filament weight [g] : 20', '; total estimated time: 0s\n; total filament weight [g] : 0']:
   with self.assertRaises(ValueError):m.gcode_stats(s)
if __name__=='__main__':unittest.main()
