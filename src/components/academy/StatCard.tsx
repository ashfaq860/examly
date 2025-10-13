import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => (
  <div className="card">
    <div className="card-body">
      <div className="d-flex align-items-center">
        <div className={`bg-${color}-subtle text-${color} p-3 rounded-circle me-3`}>
          <i className={`bi bi-${icon} fs-4`}></i>
        </div>
        <div>
          <h6 className="mb-0">{title}</h6>
          <h3 className="mb-0">{value}</h3>
          {subtitle && <small className="text-muted">{subtitle}</small>}
        </div>
      </div>
    </div>
  </div>
);

export default StatCard;