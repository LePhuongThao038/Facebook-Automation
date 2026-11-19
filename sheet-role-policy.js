// Age, status and personality are independent Sheet columns. Wealth never reverses age.
export const ROLE_SHEET_ID='18xjHAiVYeS4w8IjpJFUJuZFcZOeRdhRgZ9B46BXSa3Q';
export function sheetRoleProblem(speaker,target,role){
 if(speaker?.source?.spreadsheetId!==ROLE_SHEET_ID&&target?.source?.spreadsheetId!==ROLE_SHEET_ID)return '';
 const ranks=['Sinh viên','Đi làm','Trung niên'];
 const rank=p=>p?.concept?.ageGroup?.length===1?ranks.indexOf(p.concept.ageGroup[0]):-1;
 const a=rank(speaker),b=rank(target),junior=['junior','junior_male','junior_female'].includes(role),senior=['senior_male','senior_female','elder_relative'].includes(role);
 if((junior||senior)&&(a<0||b<0))return 'Thiếu hoặc mâu thuẫn nhóm tuổi trong Sheet; chưa được gán vai trên/dưới.';
 if(junior&&a>=b)return 'Đàn em phải thuộc nhóm tuổi nhỏ hơn chủ thể theo Sheet; không đảo vai hoặc đoán tuổi trong cùng nhóm.';
 if(senior&&a<=b)return 'Đàn anh/chị phải thuộc nhóm tuổi lớn hơn chủ thể theo Sheet; không đảo vai hoặc đoán tuổi trong cùng nhóm.';
 const gender=role.endsWith('_male')||role==='male_friend'?'male':role.endsWith('_female')||role==='female_friend'?'female':'';
 if(gender&&speaker.gender!==gender)return 'Giới tính của vai không khớp cột giới tính trong Sheet.';
 return '';
}
