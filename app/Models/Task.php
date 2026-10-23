<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected $hidden = ['search_text'];
}
