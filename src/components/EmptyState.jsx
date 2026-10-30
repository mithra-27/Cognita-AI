import { Link } from 'react-router-dom';

export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionTo,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state">

      {Icon && (
        <div
          className="empty-icon"
          aria-hidden="true"
        >
          <Icon
            size={26}
            strokeWidth={1.9}
          />
        </div>
      )}

      <h4>{title}</h4>

      <p>{message}</p>

      {onAction && actionLabel && (
        <button
          className="primary-button button-sm"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      )}

      {!onAction &&
        actionTo &&
        actionLabel && (
          <Link
            to={actionTo}
            className="primary-button button-sm"
          >
            {actionLabel}
          </Link>
        )}

    </div>
  );
}
