<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use HasUlids;
    use SoftDeletes;

    protected $guarded = [];

    protected $hidden = ['search_text'];
}
