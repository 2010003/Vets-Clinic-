import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarView = ({ appointments, selectedDate, onDateSelect }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Helpers
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const handleMonthChange = (offset) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
    };

    const formatDate = (date) => date.toISOString().split('T')[0];
    const isSameDay = (d1, d2) => d1.toISOString().split('T')[0] === d2;

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const selectedDateString = formatDate(selectedDate);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleMonthChange(-1)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => handleMonthChange(1)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 mb-4 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2">
                {/* Empty slots for first day offset */}
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}

                {/* Days */}
                {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    // Adjust for timezone to avoid date shifting when formatting
                    const offsetDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
                    const dateStr = formatDate(offsetDate);

                    const isSelected = selectedDateString === dateStr;
                    const isToday = isSameDay(new Date(), dateStr);

                    // Filter appointments for this specific day
                    const dayAppts = appointments.filter(a => a.date === dateStr);

                    return (
                        <button
                            key={day}
                            onClick={() => onDateSelect(offsetDate)}
                            className={`
                                relative h-24 rounded-xl border flex flex-col items-start justify-between p-2 transition-all
                                ${isSelected
                                    ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30'
                                    : 'border-slate-100 bg-white hover:border-emerald-200'
                                }
                            `}
                        >
                            <span className={`text-sm font-semibold ${isToday ? 'bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                                {day}
                            </span>

                            {/* Appointment Dots */}
                            <div className="flex gap-1 flex-wrap content-end w-full">
                                {dayAppts.length > 0 && (
                                    dayAppts.slice(0, 4).map((a, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1.5 w-1.5 rounded-full ${a.type === 'Surgery' ? 'bg-rose-500' :
                                                    a.type === 'Vaccination' ? 'bg-blue-500' :
                                                        'bg-emerald-500'
                                                }`}
                                        />
                                    ))
                                )}
                                {dayAppts.length > 4 && <span className="text-[10px] text-slate-400 leading-none">+</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarView;