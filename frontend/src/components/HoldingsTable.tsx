import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Holding } from "@/types";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";

interface HoldingsTableProps {
  holdings: Holding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {holdings.map((holding) => {
            const plPercent = ((holding.lastPrice - holding.avgPrice) / holding.avgPrice) * 100;
            const isPositive = holding.pl >= 0;
            const isExpanded = expandedRow === holding.symbol;

            return (
              <div key={holding.symbol}>
                <div 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => setExpandedRow(isExpanded ? null : holding.symbol)}
                >
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="font-medium">{holding.symbol}</div>
                      <div className="text-sm text-muted-foreground">{holding.name}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(holding.lastPrice)}</div>
                      <div className="text-sm text-muted-foreground">
                        {holding.qty} shares
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(holding.pl)}</div>
                      <div className={`text-sm flex items-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {formatPercent(plPercent)}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge variant="secondary">{formatPercent(holding.weight)}</Badge>
                    </div>
                    
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Avg Price</div>
                        <div className="font-medium">{formatCurrency(holding.avgPrice)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last Price</div>
                        <div className="font-medium">{formatCurrency(holding.lastPrice)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Quantity</div>
                        <div className="font-medium">{holding.qty}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Weight</div>
                        <div className="font-medium">{formatPercent(holding.weight)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
