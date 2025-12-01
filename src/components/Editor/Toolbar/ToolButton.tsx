import React from 'react';

interface ToolButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger';
    title?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
                                                          icon,
                                                          label,
                                                          onClick,
                                                          disabled = false,
                                                          variant = 'default',
                                                          title
                                                      }) => {
    const baseClasses = "flex items-center gap-2 px-3 py-2 rounded transition-colors";
    const variantClasses = {
        default: "bg-gray-100 text-gray-700 hover:bg-gray-200",
        danger: "bg-red-100 text-red-700 hover:bg-red-200"
    };
    const disabledClasses = "opacity-50 cursor-not-allowed";

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title || label}
            className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${disabled ? disabledClasses : ''}
      `}
        >
            {icon}
            <span className="text-sm">{label}</span>
        </button>
    );
};