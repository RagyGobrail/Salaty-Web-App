export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // set mid-day to avoid transitions
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

export function getDaysOfWeek(): { name: string; dateStr: string; isToday: boolean; label: string }[] {
  const daysArabic = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayStr = getLocalDateString();
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
  
  const days: { name: string; dateStr: string; isToday: boolean; label: string }[] = [];
  
  for (let i = 0; i < 7; i++) {
    // We want the current week (from Sunday to Saturday)
    const d = new Date(today);
    const diff = i - currentDayOfWeek;
    d.setDate(today.getDate() + diff);
    const dateStr = getLocalDateString(d);
    
    days.push({
      name: daysArabic[i],
      dateStr,
      isToday: dateStr === todayStr,
      label: daysArabic[i]
    });
  }
  
  return days;
}

export function formatArabicDate(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateIso;
  }
}
