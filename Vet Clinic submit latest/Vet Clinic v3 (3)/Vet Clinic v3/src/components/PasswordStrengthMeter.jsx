import { Check, X } from 'lucide-react';

const PasswordStrengthMeter = ({ password }) => {
    const checks = [
        { label: "At least 8 characters", valid: password.length >= 8 },
        { label: "Contains a number", valid: /\d/.test(password) },
        { label: "Contains a special character", valid: /[!@#$%^&*]/.test(password) },
        { label: "Contains uppercase letter", valid: /[A-Z]/.test(password) },
    ];

    const strength = checks.filter(c => c.valid).length;

    // 0-1: Weak (Red), 2-3: Medium (Yellow), 4: Strong (Green)
    const getColor = () => {
        if (strength <= 1) return 'bg-red-500';
        if (strength <= 3) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    const getLabel = () => {
        if (strength <= 1) return 'Weak';
        if (strength <= 3) return 'Medium';
        return 'Strong';
    };

    return (
        <div className="mt-3 space-y-3">
            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-300 ${getColor()}`}
                    style={{ width: `${(strength / 4) * 100}%` }}
                ></div>
            </div>

            <p className={`text-xs font-bold text-right ${strength <= 1 ? 'text-red-500' : strength <= 3 ? 'text-yellow-600' : 'text-emerald-600'
                }`}>
                {password.length > 0 && getLabel()}
            </p>

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-2">
                {checks.map((check, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs">
                        {check.valid ? (
                            <Check size={12} className="text-emerald-500" strokeWidth={3} />
                        ) : (
                            <div className="w-3 h-3 rounded-full border border-slate-300"></div>
                        )}
                        <span className={check.valid ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                            {check.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PasswordStrengthMeter;