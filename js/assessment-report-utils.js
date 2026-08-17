/* SAMS Assessment Report Utilities
   Discipline deductions are individual: only the selected student's
   studentId receives the deduction. Class totals may include the deduction
   exactly once. */
(function(global){
  "use strict";
  global.SAMSAssessmentReports = {
    studentPoint(record, studentId){
      if(!record || !Array.isArray(record.records)) return 0;
      return record.records.reduce((sum,item)=>{
        const p=Number(item.point);
        if(!Number.isFinite(p)) return sum;
        if(record.area==="Discipline" || item.individualOnly===true || item.studentId){
          return String(item.studentId||"")===String(studentId||"") ? sum+p : sum;
        }
        return sum+p;
      },0);
    },
    classPoint(record){
      if(!record || record.affectsClassTotal===false) return 0;
      return (Array.isArray(record.records)?record.records:[]).reduce((sum,item)=>{
        const p=Number(item.point);
        return Number.isFinite(p) ? sum+p : sum;
      },0);
    }
  };
})(window);
