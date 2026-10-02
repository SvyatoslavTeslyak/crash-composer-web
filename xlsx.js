/* A one-sheet Excel workbook, written and read without a library.
   write() makes an .xlsx of plain text cells: a bold header row that stays put while scrolling,
   a filter on it, set column widths, wrapped text and hidden columns. read() gives back the first
   sheet's cells as rows of strings from an .xlsx saved by Excel, Numbers or Google Sheets. */
(function(root){
'use strict';
const enc=new TextEncoder(),dec=new TextDecoder();
const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=CRC[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0};
const xml=s=>String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const column=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};

// Stored (uncompressed) zip: every spreadsheet app opens it, and it needs no deflate.
function zip(files){
 const parts=[],central=[];let offset=0;
 for(const [name,text] of files){
  const data=enc.encode(text),path=enc.encode(name),crc=crc32(data),head=new DataView(new ArrayBuffer(30));
  head.setUint32(0,0x04034b50,true);head.setUint16(4,20,true);head.setUint16(6,0x0800,true);head.setUint32(14,crc,true);head.setUint32(18,data.length,true);head.setUint32(22,data.length,true);head.setUint16(26,path.length,true);
  const entry=new DataView(new ArrayBuffer(46));
  entry.setUint32(0,0x02014b50,true);entry.setUint16(4,20,true);entry.setUint16(6,20,true);entry.setUint16(8,0x0800,true);entry.setUint32(16,crc,true);entry.setUint32(20,data.length,true);entry.setUint32(24,data.length,true);entry.setUint16(28,path.length,true);entry.setUint32(42,offset,true);
  parts.push(new Uint8Array(head.buffer),path,data);central.push(new Uint8Array(entry.buffer),path);offset+=30+path.length+data.length;
 }
 const size=central.reduce((n,p)=>n+p.length,0),end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,size,true);end.setUint32(16,offset,true);
 const all=[...parts,...central,new Uint8Array(end.buffer)],out=new Uint8Array(all.reduce((n,p)=>n+p.length,0));let at=0;for(const p of all){out.set(p,at);at+=p.length}return out;
}

// columns: [{title, width, hidden, muted}]; rows: arrays of strings in the same order.
function write({sheet='Sheet1',columns,rows}){
 const cell=(value,r,c,style)=>'<c r="'+column(c)+r+'" t="inlineStr" s="'+style+'"><is><t xml:space="preserve">'+xml(value??'')+'</t></is></c>';
 const last=column(columns.length-1)+(rows.length+1);
 const body='<row r="1">'+columns.map((col,c)=>cell(col.title,1,c,1)).join('')+'</row>'+rows.map((row,i)=>'<row r="'+(i+2)+'">'+columns.map((col,c)=>cell(row[c],i+2,c,col.muted?3:2)).join('')+'</row>').join('');
 const sheetXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+last+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>'+columns.map((col,c)=>'<col min="'+(c+1)+'" max="'+(c+1)+'" width="'+(col.width||16)+'" customWidth="1"'+(col.hidden?' hidden="1"':'')+'/>').join('')+'</cols><sheetData>'+body+'</sheetData><autoFilter ref="A1:'+last+'"/></worksheet>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF808080"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 return zip([
  ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xml(sheet.slice(0,31))+'" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\''+xml(sheet.slice(0,31))+'\'!$A$1:$'+last.replace(/(\d+)$/,'$$$1')+'</definedName></definedNames></workbook>'],
  ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
  ['xl/styles.xml',styles],
  ['xl/worksheets/sheet1.xml',sheetXml]
 ]);
}

async function unzip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map();
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break}
 if(end<0)throw Error('This is not an Excel file (.xlsx).');
 let at=view.getUint32(end+16,true);const count=view.getUint16(end+10,true);
 for(let n=0;n<count;n++){
  if(view.getUint32(at,true)!==0x02014b50)throw Error('The Excel file is damaged.');
  const method=view.getUint16(at+10,true),size=view.getUint32(at+20,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
  const name=dec.decode(bytes.subarray(at+46,at+46+nameLength));at+=46+nameLength+extra+comment;
  files.set(name.replace(/^\//,''),async()=>{const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=bytes.subarray(start,start+size);
   if(method===0)return dec.decode(data);if(method!==8)throw Error('The Excel file uses an unsupported compression.');
   return dec.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())});
 }
 return files;
}
const unescape=s=>s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi,(_,hex,num,name)=>hex?String.fromCodePoint(parseInt(hex,16)):num?String.fromCodePoint(+num):{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name.toLowerCase()]).replace(/_x([0-9A-F]{4})_/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
// The text of a string item: every <t> run, without phonetic hints.
const runs=s=>[...s.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g,'').matchAll(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)].map(m=>unescape(m[1]||'')).join('');
const attr=(tag,name)=>tag.match(new RegExp('\\s'+name+'="([^"]*)"'))?.[1];

async function read(buffer){
 const files=await unzip(buffer),text=async name=>{const f=files.get(name);return f?f():null};
 const workbook=await text('xl/workbook.xml');if(!workbook)throw Error('This is not an Excel file (.xlsx).');
 const first=workbook.match(/<(?:\w+:)?sheet\b[^>]*>/)?.[0],id=first&&(attr(first,'r:id')||attr(first,'[\\w]+:id'));
 const rels=await text('xl/_rels/workbook.xml.rels')||'',rel=[...rels.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)].map(m=>m[0]).find(r=>attr(r,'Id')===id);
 let target=rel?attr(rel,'Target'):'worksheets/sheet1.xml';target=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
 const sheet=await text(target);if(!sheet)throw Error('The Excel file has no sheet.');
 const shared=[...((await text('xl/sharedStrings.xml'))||'').matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\b[^>]*\/>/g)].map(m=>runs(m[1]||''));
 const rows=[];
 for(const row of sheet.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)){
  const index=(+attr(row[1],'r')||rows.length+1)-1,cells=[];let next=0;
  for(const c of (row[2]||'').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)){
   const ref=attr(c[1],'r'),type=attr(c[1],'t'),inner=c[2]||'';
   let col=next;if(ref){col=0;for(const ch of ref.replace(/\d+$/,''))col=col*26+ch.charCodeAt(0)-64;col--}next=col+1;
   const v=inner.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
   cells[col]=type==='s'?shared[+v]??'':type==='inlineStr'?runs(inner.match(/<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/)?.[1]||''):type==='b'?(v==='1'?'TRUE':'FALSE'):unescape(v??'');
  }
  rows[index]=Array.from(cells,x=>x??'');
 }
 return Array.from(rows,r=>r??[]);
}
root.ComposerXlsx={write,read};
})(typeof window==='undefined'?globalThis:window);
