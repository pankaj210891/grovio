import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const products = [
  { id: 'P001', name: 'Wireless Headphones Pro', category: 'Electronics', price: '₹2,499', stock: 142, status: 'active' as const },
  { id: 'P002', name: 'Ergonomic Office Chair', category: 'Furniture', price: '₹12,999', stock: 8, status: 'active' as const },
  { id: 'P003', name: 'Stainless Steel Bottle', category: 'Kitchen', price: '₹599', stock: 0, status: 'draft' as const },
  { id: 'P004', name: 'Running Shoes — Air Flex', category: 'Sports', price: '₹3,299', stock: 55, status: 'active' as const },
  { id: 'P005', name: 'Plant-based Protein Powder', category: 'Health', price: '₹1,899', stock: 23, status: 'archived' as const },
];

const statusVariant = {
  active: 'success',
  draft: 'secondary',
  archived: 'muted',
} as const;

const meta: Meta = {
  title: 'UI/DataTable',
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ProductsTable: Story = {
  render: () => (
    <Table aria-label="Products table">
      <TableCaption>Product catalog — 5 items</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">ID</TableHead>
          <TableHead scope="col">Product</TableHead>
          <TableHead scope="col">Category</TableHead>
          <TableHead scope="col" className="text-right">Price</TableHead>
          <TableHead scope="col" className="text-right">Stock</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col" className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{product.id}</TableCell>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell className="text-muted-foreground">{product.category}</TableCell>
            <TableCell className="text-right tabular-nums">{product.price}</TableCell>
            <TableCell className={`text-right tabular-nums ${product.stock === 0 ? 'text-destructive' : product.stock < 10 ? 'text-warning' : ''}`}>
              {product.stock}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant[product.status]}>
                {product.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="sm">Edit</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <Table aria-label="Products table">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">ID</TableHead>
          <TableHead scope="col">Product</TableHead>
          <TableHead scope="col">Category</TableHead>
          <TableHead scope="col" className="text-right">Price</TableHead>
          <TableHead scope="col">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
            No products found.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
