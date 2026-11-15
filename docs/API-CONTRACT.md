# Internal implementation contract

All endpoints use JSON and same-origin session cookies. Dates are YYYY-MM-DD strings; IDs are UUID strings. Slot values are exported by shared/domain.js.

- Public GET /api/config => {today,timeZone}
- GET /api/auth/me => {user:{id,name,email},today,timeZone}; 401 when logged out.
- POST /api/auth/register {name,email,password} => same payload, 201, logged in.
- POST /api/auth/login {email,password} => same payload, 200.
- POST /api/auth/logout => 204.
- GET /api/readings?date=YYYY-MM-DD => {date,readings:[{id,date,slot,value}]}.
- POST /api/readings {date,slot,value} => {reading}, 201.
- PATCH /api/readings/:id {date,slot,value} => {reading}, 200 (full editable form payload).
- DELETE /api/readings/:id => 204.
- GET /api/reports?date=YYYY-MM-DD => {date,today,timeZone,daily,monthToDate,previousMonth}.
- Each report: {startDate,endDate,count,min,max,average}; daily also has readings in slot order. Average rounded to one decimal. Empty: count0, min/max/average null.
- Errors: {error:{code,message,fields?}}. Validation400, unauthorized401, origin403, ownership/missing404, duplicate/full409, rate limit429.
- No-op edits allowed. Full-day error precedes duplicate-slot error for creates; edits exclude the edited row when counting destination readings.
- Reading body accepts numeric value only; browser converts nonblank input to number. Server strictly validates.
- Demo account: demo@sweety.example / SweetyDemo123! (fictional, documented).

Folders: root agent owns shared/, package/config/Docker/docs. Backend agent owns server/ and tests/api.test.js. Frontend agent owns client/ and tests/ReadingForm.test.jsx. Root owns tests/shared.test.js and final integration.
