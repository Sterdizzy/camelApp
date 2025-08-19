import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, Clock, RefreshCw, AlertCircle } from 'lucide-react';

export function PriceDisplay({
  price,
  priceStatus,
  lastUpdate,
  isLoading = false,
  showStatus = true,
  size = 'default', // 'small', 'default', 'large'
  onRetry = null,
  showRetryButton = false
}) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'fresh':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <Wifi className="w-3 h-3" />,
          label: 'Live',
          showTimestamp: false
        };
      case 'recent':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <Clock className="w-3 h-3" />,
          label: getTimeAgo(lastUpdate),
          showTimestamp: true
        };
      case 'stale':
        return {
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />,
          label: isLoading ? 'Refreshing...' : 'Outdated',
          showTimestamp: true
        };
      case 'failed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: <AlertCircle className="w-3 h-3" />,
          label: 'Failed to update',
          showTimestamp: true
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-600 border-gray-200',
          icon: <Clock className="w-3 h-3" />,
          label: 'Unknown',
          showTimestamp: false
        };
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getSizeClasses = (size) => {
    switch (size) {
      case 'small':
        return 'text-sm font-semibold';
      case 'large':
        return 'text-xl font-bold';
      default:
        return 'text-base font-bold';
    }
  };

  const statusConfig = getStatusConfig(priceStatus);

  if (isLoading && !price) {
    // Skeleton UI for initial loading
    return (
      <div className="flex items-center gap-2">
        <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
        {showStatus && (
          <div className="animate-pulse bg-gray-200 h-5 w-16 rounded-full"></div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Price information">
      {/* Price with accessibility */}
      <span 
        className={`text-slate-50 ${getSizeClasses(size)}`}
        aria-label={`Current price ${formatCurrency(price)}`}
      >
        {formatCurrency(price)}
      </span>
      
      {/* Status indicator */}
      {showStatus && priceStatus && (
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-xs ${statusConfig.color}`}
            aria-label={`Price status: ${statusConfig.label}`}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
          
          {/* Retry button for failed status */}
          {showRetryButton && priceStatus === 'failed' && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-xs"
              aria-label="Retry price update"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
      
      {/* Live region for screen readers */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        key={`${price}-${priceStatus}-${lastUpdate}`}
      >
        {isLoading ? 'Price updating' : ''}
      </div>
    </div>
  );
}

export function PriceChangeIndicator({
  currentPrice,
  previousPrice,
  percentage,
  size = 'default',
  showArrow = true
}) {
  const change = (currentPrice || 0) - (previousPrice || 0);
  
  const getChangeColor = () => {
    if (Math.abs(percentage) < 0.01) return 'text-slate-500';
    if (percentage > 0.01) return 'text-green-600';
    if (percentage < -0.01) return 'text-red-600';
    return 'text-slate-500';
  };

  const getSizeClasses = (size) => {
    switch (size) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  const getArrow = () => {
    if (!showArrow) return '';
    if (percentage > 0.01) return '▲';
    if (percentage < -0.01) return '▼';
    return '▬';
  };

  const formatPercentage = (percent) => {
    return `${(percent || 0).toFixed(2)}%`;
  };

  return (
    <div 
      className={`flex items-center gap-1 ${getChangeColor()} ${getSizeClasses(size)} font-semibold`}
      role="group"
      aria-label={`Price change: ${percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'unchanged'} ${formatPercentage(Math.abs(percentage || 0))}`}
    >
      {showArrow && <span aria-hidden="true">{getArrow()}</span>}
      <span>{formatPercentage(Math.abs(percentage || 0))}</span>
    </div>
  );
}