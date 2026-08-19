SAMS DISCIPLINE DEDUCTION RULE

Required behaviour:
- If one student receives a Discipline deduction of -2, the class total decreases by 2.
- Only that affected student's individual report shows -2.
- Every other student's individual report remains unchanged by that deduction.

Implementation verified in js/reports.js:
- disciplineForStudent() filters Discipline records by studentId.
- allDisciplinePoints() includes each Discipline deduction once in the class total.
- Individual report displays only matching student discipline records.
- Class report applies each student's own discipline deduction to that student's total.
