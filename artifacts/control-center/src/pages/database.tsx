import React, { useState } from "react";
import { useListDbTables, useGetDbTableRows } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Search, HardDrive, Hash, AlignLeft, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DatabasePage() {
  const { data: tables, isLoading: tablesLoading } = useListDbTables();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredTables = tables?.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  // Auto-select first table if none selected
  React.useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  return (
    <div className="flex h-full max-w-[1800px] mx-auto overflow-hidden">
      
      {/* Tables Sidebar */}
      <div className="w-80 border-r border-white/5 bg-card/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5 bg-black/20">
          <h2 className="font-bold tracking-tight mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Database Explorer
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Filter tables..." 
              className="pl-8 bg-black/40 border-white/10 font-mono text-xs h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {tablesLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-white/5 animate-pulse rounded-md" />)}
            </div>
          ) : (
            filteredTables?.map(table => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedTable === table.name 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-transparent border-transparent hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-sm font-semibold truncate ${selectedTable === table.name ? 'text-primary' : 'text-foreground'}`}>
                    {table.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {table.rowCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {(table.sizeBytes / 1024).toFixed(1)} KB</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Table Data View */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {selectedTable ? (
          <TableViewer tableName={selectedTable} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground/50">
            <div className="flex flex-col items-center">
              <Database className="w-16 h-16 mb-4" />
              <span className="font-mono text-sm">NO_TABLE_SELECTED</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TableViewer({ tableName }: { tableName: string }) {
  const [page, setPage] = useState(0);
  const limit = 50;
  
  const { data: tableData, isLoading, isFetching } = useGetDbTableRows(
    tableName, 
    { limit, offset: page * limit },
    { query: { enabled: !!tableName, keepPreviousData: true } }
  );

  // Reset page when table changes
  React.useEffect(() => {
    setPage(0);
  }, [tableName]);

  const renderCellContent = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground/50 italic">null</span>;
    if (typeof value === 'boolean') return <span className={value ? 'text-success' : 'text-destructive'}>{value.toString()}</span>;
    if (typeof value === 'object') return <span className="text-primary/70">{JSON.stringify(value)}</span>;
    return String(value);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-white/5 bg-card/40 flex items-center justify-between px-6 shrink-0">
        <h3 className="font-mono text-lg font-bold text-foreground">
          <span className="text-primary mr-2">SELECT * FROM</span>
          {tableName}
        </h3>
        
        {tableData && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-muted-foreground">
              ROWS {page * limit + 1}-{Math.min((page + 1) * limit, tableData.total)} OF {tableData.total}
            </span>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 border-white/10 bg-black/20"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
              >
                PREV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 border-white/10 bg-black/20"
                onClick={() => setPage(p => p + 1)}
                disabled={!tableData || (page + 1) * limit >= tableData.total || isLoading}
              >
                NEXT
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-black/10 relative p-4">
        {(isLoading && !tableData) ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !tableData || tableData.rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
            TABLE_IS_EMPTY
          </div>
        ) : (
          <div className={`border border-white/5 rounded-lg overflow-hidden bg-card/40 transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-white/5 hover:bg-transparent">
                  {tableData.columns.map((col, i) => (
                    <TableHead key={i} className="font-mono text-xs text-primary whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.rows.map((row, i) => (
                  <TableRow key={i} className="border-white/5 hover:bg-white/5 transition-colors">
                    {tableData.columns.map((col, j) => (
                      <TableCell key={j} className="font-mono text-xs whitespace-nowrap max-w-[300px] truncate">
                        {renderCellContent(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
